/*
  Admin dashboard backend: credential sign-in, platform stats, and moderation of users and listings.

  Admins sign in with a username + password (not a phone OTP). The account is created on first start from
  ADMIN_USERNAME / ADMIN_PASSWORD; in development a documented default password is used. Its placeholder phone
  (+233000000000) can never pass phone validation, so the account cannot be reached through the OTP flow.
*/
import bcrypt from 'bcryptjs';
import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { conversations, messages, produceListings, refreshTokens, reviews, users } from '../db/schema.js';
import { kv } from '../config/redis.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { authService } from './auth.service.js';
import { listingService } from './listing.service.js';
import { userRepository, toProfile } from '../repositories/user.repository.js';
import { toListingDto } from '../repositories/listing.repository.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, RateLimitError, UnauthorizedError } from '../utils/errors.js';

const ADMIN_PHONE = '+233000000000';
const BCRYPT_COST = 12;
// A real hash to compare against when the username does not exist, so timing does not reveal valid usernames
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

class AdminService {
  /** Create the admin account if it does not exist yet. An existing account (and any changed password) is left alone. */
  async ensureAdmin(): Promise<'created' | 'exists' | 'disabled'> {
    const { username, password } = config.admin;
    if (!password) {
      logger.warn('ADMIN_PASSWORD is not set: no admin account was created');
      return 'disabled';
    }

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing) return 'exists';

    await db.insert(users).values({
      phone: ADMIN_PHONE,
      phoneVerified: true,
      username,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      name: 'Administrator',
      role: 'ADMIN',
    });
    logger.info(`Admin account created (username "${username}")`);
    if (config.admin.usingDevPassword) {
      logger.info(`Development admin credentials -> username: ${username}  password: ${password}`);
    }
    return 'created';
  }

  async login(rawUsername: string, password: string) {
    const username = rawUsername.trim().toLowerCase();
    const lockKey = `admin:lock:${username}`;
    const failKey = `admin:fail:${username}`;

    if (await kv.exists(lockKey)) {
      const wait = await kv.ttl(lockKey);
      throw new RateLimitError(wait, 'ADMIN_LOCKED', 'Too many failed attempts. Try again later.');
    }

    const [user] = await db.select().from(users).where(eq(sql`lower(${users.username})`, username)).limit(1);
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !valid || user.role !== 'ADMIN' || !user.isActive) {
      const failures = await kv.incr(failKey);
      if (failures === 1) await kv.expire(failKey, config.admin.lockSeconds);
      if (failures >= config.admin.maxFailures) {
        await kv.set(lockKey, '1', { ex: config.admin.lockSeconds });
        await kv.del(failKey);
        throw new RateLimitError(config.admin.lockSeconds, 'ADMIN_LOCKED', 'Too many failed attempts. Try again later.');
      }
      throw new UnauthorizedError('Incorrect username or password', 'INVALID_CREDENTIALS');
    }

    await kv.del(failKey);
    const updated = (await userRepository.update(user.id, { lastLoginAt: new Date() }))!;
    const tokens = await authService.issueTokens(updated);
    return {
      user: { id: updated.id, phone: updated.phone, name: updated.name, role: updated.role, isNewUser: false },
      tokens,
    };
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    const user = await userRepository.findById(adminId);
    if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedError('Current password is incorrect', 'INVALID_CREDENTIALS');
    }
    if (currentPassword === newPassword) throw new BadRequestError('Choose a password you have not used before');

    await userRepository.update(adminId, { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST) });
    // End every other session; the caller gets fresh tokens
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, adminId));
    return authService.issueTokens((await userRepository.findById(adminId))!);
  }

  // ─── Overview ──────────────────────────

  async stats() {
    const day = sql`date_trunc('day', ${users.createdAt})`;

    const [byRole, byStatus, [userTotals], [totals], topProduce, signups] = await Promise.all([
      db.select({ role: users.role, n: count() }).from(users).groupBy(users.role),
      db.select({ status: produceListings.status, n: count() }).from(produceListings).groupBy(produceListings.status),
      db
        .select({
          total: count(),
          active: sql<number>`count(*) filter (where ${users.isActive})::int`,
          newLast7: sql<number>`count(*) filter (where ${users.createdAt} > now() - interval '7 days')::int`,
        })
        .from(users),
      db
        .select({
          conversations: sql<number>`(select count(*) from ${conversations})::int`,
          messages: sql<number>`(select count(*) from ${messages})::int`,
          reviews: sql<number>`(select count(*) from ${reviews})::int`,
          views: sql<number>`coalesce((select sum(${produceListings.viewCount}) from ${produceListings}), 0)::int`,
        })
        .from(sql`(select 1) as one`),
      db
        .select({ produce: produceListings.produceType, n: count() })
        .from(produceListings)
        .where(eq(produceListings.status, 'ACTIVE'))
        .groupBy(produceListings.produceType)
        .orderBy(desc(count()), produceListings.produceType)
        .limit(5),
      db
        .select({ day: sql<string>`to_char(${day}, 'YYYY-MM-DD')`, n: count() })
        .from(users)
        .where(sql`${users.createdAt} > now() - interval '14 days'`)
        .groupBy(day)
        .orderBy(day),
    ]);

    const roleCount = (r: string) => byRole.find((x) => x.role === r)?.n ?? 0;
    const statusCount = (s: string) => byStatus.find((x) => x.status === s)?.n ?? 0;

    return {
      users: {
        total: userTotals.total,
        active: userTotals.active,
        deactivated: userTotals.total - userTotals.active,
        newLast7Days: userTotals.newLast7,
        farmers: roleCount('FARMER'),
        buyers: roleCount('BUYER'),
        admins: roleCount('ADMIN'),
      },
      listings: {
        total: byStatus.reduce((n, s) => n + s.n, 0),
        active: statusCount('ACTIVE'),
        sold: statusCount('SOLD'),
        expired: statusCount('EXPIRED'),
        deactivated: statusCount('DEACTIVATED'),
      },
      activity: totals,
      topProduce: topProduce.map((t) => ({ produce: t.produce, listings: t.n })),
      signups: signups.map((s) => ({ day: s.day, count: s.n })),
    };
  }

  // ─── Users ─────────────────────────────

  async listUsers(f: { search?: string; role?: 'FARMER' | 'BUYER' | 'ADMIN'; status?: 'active' | 'inactive'; page: number; limit: number }) {
    const conditions: SQL[] = [];
    if (f.role) conditions.push(eq(users.role, f.role));
    if (f.status) conditions.push(eq(users.isActive, f.status === 'active'));
    if (f.search) {
      const like = `%${likeEscape(f.search)}%`;
      conditions.push(or(ilike(users.name, like), ilike(users.phone, like), ilike(users.username, like))!);
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          user: users,
          // Qualified by hand: Drizzle omits table names in single-table selects, which would make this compare a listing to itself
          listingCount: sql<number>`(select count(*) from produce_listings pl where pl.farmer_id = "users"."id")::int`,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(f.limit)
        .offset((f.page - 1) * f.limit),
      db.select({ total: count() }).from(users).where(where),
    ]);

    return {
      items: rows.map((r) => ({
        ...toProfile(r.user),
        username: r.user.username,
        isActive: r.user.isActive,
        lastLoginAt: r.user.lastLoginAt,
        listingCount: r.listingCount,
      })),
      pagination: { total, page: f.page, limit: f.limit, totalPages: Math.ceil(total / f.limit) },
    };
  }

  async updateUser(adminId: string, targetId: string, changes: { isActive?: boolean; role?: 'FARMER' | 'BUYER' | 'ADMIN' }) {
    const target = await userRepository.findById(targetId);
    if (!target) throw new NotFoundError('User not found');

    if (target.id === adminId) {
      if (changes.isActive === false) throw new ForbiddenError('You cannot deactivate your own account');
      if (changes.role && changes.role !== target.role) throw new ForbiddenError('You cannot change your own role');
    }
    // The admin account signs in with a password; making someone else an admin would leave them with no way in
    if (changes.role === 'ADMIN' && target.role !== 'ADMIN') {
      throw new ConflictError('Admin accounts are created through ADMIN_USERNAME / ADMIN_PASSWORD, not promoted');
    }
    if (target.role === 'ADMIN' && changes.role && changes.role !== 'ADMIN') {
      throw new ConflictError('An admin account cannot be turned into a regular account');
    }

    const updated = await userRepository.update(targetId, changes);
    if (changes.isActive === false) {
      // Sign them out everywhere; the access token is also rejected immediately because authenticate checks isActive
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, targetId));
    }
    return { ...toProfile(updated!), isActive: updated!.isActive };
  }

  // ─── Listings ──────────────────────────

  async listListings(f: { search?: string; status?: 'ACTIVE' | 'SOLD' | 'EXPIRED' | 'DEACTIVATED'; page: number; limit: number }) {
    const conditions: SQL[] = [];
    if (f.status) conditions.push(eq(produceListings.status, f.status));
    if (f.search) {
      const like = `%${likeEscape(f.search)}%`;
      conditions.push(or(ilike(produceListings.produceType, like), ilike(produceListings.location, like), ilike(users.name, like))!);
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const base = db.select({ n: count() }).from(produceListings).innerJoin(users, eq(produceListings.farmerId, users.id));
    const [rows, [{ n: total }]] = await Promise.all([
      db
        .select({ listing: produceListings, farmer: { id: users.id, name: users.name, phone: users.phone } })
        .from(produceListings)
        .innerJoin(users, eq(produceListings.farmerId, users.id))
        .where(where)
        .orderBy(desc(produceListings.createdAt))
        .limit(f.limit)
        .offset((f.page - 1) * f.limit),
      where ? base.where(where) : base,
    ]);

    return {
      items: rows.map((r) => ({ ...toListingDto(r.listing), farmer: r.farmer })),
      pagination: { total, page: f.page, limit: f.limit, totalPages: Math.ceil(total / f.limit) },
    };
  }

  async setListingStatus(listingId: string, status: 'ACTIVE' | 'SOLD' | 'EXPIRED' | 'DEACTIVATED') {
    const [updated] = await db
      .update(produceListings)
      .set({ status, updatedAt: new Date() })
      .where(eq(produceListings.id, listingId))
      .returning();
    if (!updated) throw new NotFoundError('Listing not found');
    return toListingDto(updated);
  }

  deleteListing(adminId: string, listingId: string) {
    return listingService.remove({ sub: adminId, role: 'ADMIN' }, listingId);
  }
}

export const adminService = new AdminService();
