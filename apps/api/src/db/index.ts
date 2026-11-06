/*
  Drizzle client.

  - DATABASE_URL set      -> Neon serverless Postgres (what the docs specify)
  - DATABASE_URL empty    -> embedded Postgres via PGlite, persisted under DATA_DIR (no account or install needed)
  - NODE_ENV=test or DATABASE_URL=memory:// -> PGlite in memory

  The schema and every query are plain Postgres, so the choice only changes the driver.
*/
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import * as schema from './schema.js';

export type DB = PgDatabase<any, typeof schema>;

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

interface Driver {
  db: DB;
  kind: 'neon' | 'pglite';
  migrate: () => Promise<void>;
  close: () => Promise<void>;
}

async function createNeon(url: string): Promise<Driver> {
  const { drizzle } = await import('drizzle-orm/neon-serverless');
  const { migrate } = await import('drizzle-orm/neon-serverless/migrator');
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  const { default: ws } = await import('ws');

  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: url, max: 20, idleTimeoutMillis: 30_000 });
  const db = drizzle(pool, { schema });
  return {
    db: db as unknown as DB,
    kind: 'neon',
    migrate: () => migrate(db, { migrationsFolder }),
    close: () => pool.end(),
  };
}

async function createPglite(inMemory: boolean): Promise<Driver> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');

  let client: InstanceType<typeof PGlite>;
  let releaseLock = () => {};
  if (inMemory) {
    client = new PGlite();
  } else {
    const dir = path.resolve(config.database.dataDir, 'pglite');
    fs.mkdirSync(dir, { recursive: true });
    releaseLock = acquireDirLock(path.resolve(config.database.dataDir, 'pglite.lock'), dir);
    try {
      client = new PGlite(dir);
      await client.waitReady;
    } catch (err) {
      releaseLock();
      throw new Error(
        `The embedded database in ${dir} failed to start (${(err as Error).message}). ` +
          'This usually means the folder was damaged by a crash or by two servers using it at once. ' +
          'Stop every API process, move that folder aside (or delete it), and start again; migrations rebuild it and `npm run db:seed` restores the sample data.',
      );
    }
  }
  await client.waitReady;

  const db = drizzle(client, { schema });
  return {
    db: db as unknown as DB,
    kind: 'pglite',
    migrate: () => migrate(db, { migrationsFolder }),
    close: async () => {
      await client.close();
      releaseLock();
    },
  };
}

/**
 * PGlite is single-process: two servers (or a server plus `db:seed`) on one folder corrupt it.
 * A lock file holding the owner's PID makes the second one stop with a clear message instead.
 * A lock left by a crashed process (PID no longer running) is taken over.
 */
function acquireDirLock(lockFile: string, dir: string): () => void {
  const alive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return (e as NodeJS.ErrnoException).code === 'EPERM';
    }
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      const owner = Number(fs.readFileSync(lockFile, 'utf8').trim());
      if (owner && owner !== process.pid && alive(owner)) {
        throw new Error(
          `Another process (PID ${owner}) is already using the database in ${dir}. ` +
            `Stop it first (it is probably another "npm run dev" or "npm run db:seed"), then start this one again.`,
        );
      }
      fs.rmSync(lockFile, { force: true }); // stale lock from a crashed process
      if (attempt === 1) throw e;
    }
  }

  const release = () => {
    try {
      if (fs.readFileSync(lockFile, 'utf8').trim() === String(process.pid)) fs.rmSync(lockFile, { force: true });
    } catch {
      /* already gone */
    }
  };
  process.once('exit', release);
  return release;
}

async function createDriver(): Promise<Driver> {
  const url = config.database.url;
  if (url && url !== 'memory://') {
    logger.info('Database: Neon Postgres');
    return createNeon(url);
  }
  const inMemory = config.isTest || url === 'memory://';
  logger.info(inMemory ? 'Database: PGlite (in memory)' : `Database: PGlite (embedded Postgres, ${config.database.dataDir}/pglite)`);
  return createPglite(inMemory);
}

const driver = await createDriver();

export const db: DB = driver.db;
export const dbKind = driver.kind;
export const runMigrations = driver.migrate;
export const closeDb = driver.close;
