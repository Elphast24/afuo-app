/*
  Copy the data in the local embedded database (DATA_DIR/pglite) into another Postgres, normally Neon.

    NEON_DATABASE_URL="postgresql://...neon.tech/agrimatch?sslmode=require" npm run db:copy-to-neon

  - Stop the API first (the embedded database allows one process at a time).
  - Migrations are applied to the target first, so an empty Neon database is fine.
  - Rows that already exist in the target (same id) are skipped, so it is safe to run twice. Nothing is deleted.
  - NOT copied: admin accounts (the API creates its own from ADMIN_PASSWORD, so the development password never
    reaches production), sign-in sessions (everyone signs in again), and listing photos stored on local disk
    (/uploads/... files do not exist on the server; photos that point at the web app's /images are copied).
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

const target = process.env.NEON_DATABASE_URL;
if (!target) {
  console.error('Set NEON_DATABASE_URL to the target connection string (never commit it).');
  process.exit(1);
}

const dataDir = path.resolve(process.env.DATA_DIR ?? './.data');
const lockFile = path.join(dataDir, 'pglite.lock');
if (fs.existsSync(lockFile)) {
  const pid = Number(fs.readFileSync(lockFile, 'utf8').trim());
  let alive = false;
  try {
    process.kill(pid, 0);
    alive = true;
  } catch (e) {
    alive = (e as NodeJS.ErrnoException).code === 'EPERM';
  }
  if (alive && pid !== process.pid) {
    console.error(`The local database is in use by PID ${pid}. Stop the API (Ctrl+C in its terminal) and try again.`);
    process.exit(1);
  }
}

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

// Source: the embedded database, opened read-only in practice (we only select)
const { PGlite } = await import('@electric-sql/pglite');
const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
const sourceDir = path.join(dataDir, 'pglite');
if (!fs.existsSync(sourceDir)) {
  console.error(`No local database found at ${sourceDir}.`);
  process.exit(1);
}
const sourceClient = new PGlite(sourceDir);
await sourceClient.waitReady;
const source = drizzlePglite(sourceClient, { schema });

// Target: Neon, or an in-memory PGlite when the URL is memory:// (used to test this script)
let targetDb: any;
let closeTarget: () => Promise<void>;
if (target.startsWith('memory://')) {
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const c = new PGlite();
  await c.waitReady;
  targetDb = drizzle(c, { schema });
  await migrate(targetDb, { migrationsFolder });
  closeTarget = () => c.close();
} else {
  const { drizzle } = await import('drizzle-orm/neon-serverless');
  const { migrate } = await import('drizzle-orm/neon-serverless/migrator');
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  const { default: ws } = await import('ws');
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: target, max: 5 });
  targetDb = drizzle(pool, { schema });
  console.log('Applying migrations to the target...');
  await migrate(targetDb, { migrationsFolder });
  closeTarget = () => pool.end();
}

async function copy(name: string, table: any, rows: any[]) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const res = await targetDb.insert(table).values(batch).onConflictDoNothing().returning({ id: table.id });
    inserted += res.length;
  }
  console.log(`${name.padEnd(16)} ${String(rows.length).padStart(5)} read, ${String(inserted).padStart(5)} new in target`);
}

const allUsers = await source.select().from(schema.users);
const people = allUsers.filter((u) => u.role !== 'ADMIN');
const keep = new Set(people.map((u) => u.id));

await copy('users', schema.users, people);

const listings = (await source.select().from(schema.produceListings)).filter((l) => keep.has(l.farmerId));
await copy('listings', schema.produceListings, listings);
const listingIds = new Set(listings.map((l) => l.id));

const images = await source.select().from(schema.listingImages);
const usable = images.filter((i) => listingIds.has(i.listingId) && !i.url.startsWith('/uploads'));
await copy('listing images', schema.listingImages, usable);
if (usable.length < images.length) console.log(`  skipped ${images.length - usable.length} photos stored on local disk (/uploads); re-upload them on the live site`);

const convs = (await source.select().from(schema.conversations)).filter((c) => keep.has(c.buyerId) && listingIds.has(c.listingId));
await copy('conversations', schema.conversations, convs);
const convIds = new Set(convs.map((c) => c.id));

const msgs = (await source.select().from(schema.messages)).filter((m) => convIds.has(m.conversationId) && keep.has(m.senderId));
await copy('messages', schema.messages, msgs);

const revs = (await source.select().from(schema.reviews)).filter((r) => keep.has(r.reviewerId) && keep.has(r.revieweeId) && listingIds.has(r.listingId));
await copy('reviews', schema.reviews, revs);

console.log(`Skipped ${allUsers.length - people.length} admin account(s) and all sign-in sessions.`);
await closeTarget();
await sourceClient.close();
console.log('Done.');
