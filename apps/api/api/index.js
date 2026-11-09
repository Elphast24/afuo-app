var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/app.ts
import path3 from "node:path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";

// src/config/index.ts
import "dotenv/config";
import { z } from "zod";
var DEV_ACCESS_SECRET = "dev-only-access-secret-change-me-please-0000";
var DEV_REFRESH_SECRET = "dev-only-refresh-secret-change-me-please-000";
var DEV_ADMIN_PASSWORD = "AgriMatch@Admin2026";
var emptyToUndefined = (v) => v === "" ? void 0 : v;
var optionalString = z.preprocess(emptyToUndefined, z.string().optional());
var envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4e3),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: optionalString,
  DATA_DIR: z.string().default("./.data"),
  UPSTASH_REDIS_REST_URL: optionalString,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  JWT_ACCESS_SECRET: optionalString,
  JWT_REFRESH_SECRET: optionalString,
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  ADMIN_USERNAME: z.string().trim().min(3).max(50).default("admin"),
  ADMIN_PASSWORD: optionalString,
  UPLOAD_DIR: z.string().default("./uploads"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "http", "debug"]).default("info")
});
var parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
var env = parsed.data;
var isProd = env.NODE_ENV === "production";
if (isProd && (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET)) {
  console.error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required in production.");
  process.exit(1);
}
if (isProd && env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters in production.");
  process.exit(1);
}
function durationToSeconds(value) {
  const m = /^(\d+)\s*([smhd]?)$/.exec(value.trim());
  if (!m) throw new Error(`Invalid duration: ${value}`);
  const n = Number(m[1]);
  const unit2 = m[2] || "s";
  return n * { s: 1, m: 60, h: 3600, d: 86400 }[unit2];
}
var config = {
  env: env.NODE_ENV,
  isProd,
  isTest: env.NODE_ENV === "test",
  port: env.PORT,
  corsOrigins: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
  logLevel: env.LOG_LEVEL,
  database: {
    url: env.DATABASE_URL,
    dataDir: env.DATA_DIR
  },
  redis: {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN
  },
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET ?? DEV_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET ?? DEV_REFRESH_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    accessTtlSeconds: durationToSeconds(env.JWT_ACCESS_EXPIRES_IN),
    refreshTtlSeconds: durationToSeconds(env.JWT_REFRESH_EXPIRES_IN)
  },
  admin: {
    username: env.ADMIN_USERNAME,
    /** In production the admin account is only created when ADMIN_PASSWORD is set */
    password: env.ADMIN_PASSWORD ?? (isProd ? void 0 : DEV_ADMIN_PASSWORD),
    usingDevPassword: !env.ADMIN_PASSWORD && !isProd,
    lockSeconds: 900,
    maxFailures: 5
  },
  uploadDir: env.UPLOAD_DIR,
  /** requests per minute, per user (or IP when signed out). Effectively off under test. */
  rateLimit: {
    windowSeconds: 60,
    general: env.NODE_ENV === "test" ? 1e6 : 100,
    otp: env.NODE_ENV === "test" ? 1e6 : 20
  },
  otp: {
    ttlSeconds: 300,
    cooldownSeconds: 60,
    maxAttempts: 5,
    maxPerHour: 5,
    lockSeconds: 1800
  }
};

// src/config/logger.ts
import winston from "winston";
var logger = winston.createLogger({
  level: config.isTest ? "error" : config.logLevel,
  format: config.isProd ? winston.format.combine(winston.format.timestamp(), winston.format.json()) : winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "HH:mm:ss" }),
    winston.format.printf(({ timestamp: timestamp2, level, message, ...rest }) => {
      const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
      return `${timestamp2} ${level}: ${message}${extra}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

// src/routes/index.ts
import { Router } from "express";

// src/services/auth.service.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq as eq2 } from "drizzle-orm";

// src/db/index.ts
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  conversations: () => conversations,
  conversationsRelations: () => conversationsRelations,
  listingImages: () => listingImages,
  listingImagesRelations: () => listingImagesRelations,
  listingStatusEnum: () => listingStatusEnum,
  messages: () => messages,
  messagesRelations: () => messagesRelations,
  produceCategoryEnum: () => produceCategoryEnum,
  produceListings: () => produceListings,
  produceListingsRelations: () => produceListingsRelations,
  refreshTokens: () => refreshTokens,
  reviews: () => reviews,
  reviewsRelations: () => reviewsRelations,
  unitTypeEnum: () => unitTypeEnum,
  userRoleEnum: () => userRoleEnum,
  users: () => users,
  usersRelations: () => usersRelations
});
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  pgEnum,
  numeric,
  date,
  text,
  integer,
  smallint,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
var userRoleEnum = pgEnum("user_role", ["FARMER", "BUYER", "ADMIN"]);
var produceCategoryEnum = pgEnum("produce_category", [
  "VEGETABLES",
  "FRUITS",
  "GRAINS",
  "LEGUMES",
  "DAIRY",
  "LIVESTOCK",
  "OTHER"
]);
var unitTypeEnum = pgEnum("unit_type", [
  "KG",
  "TONS",
  "CRATES",
  "BAGS_90KG",
  "PIECES",
  "LITRES",
  "BUNCHES"
]);
var listingStatusEnum = pgEnum("listing_status", ["ACTIVE", "SOLD", "EXPIRED", "DEACTIVATED"]);
var users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 20 }).notNull().unique(),
    /** Admin accounts sign in with username + password instead of a phone OTP */
    username: varchar("username", { length: 50 }).unique(),
    passwordHash: varchar("password_hash", { length: 100 }),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    name: varchar("name", { length: 100 }),
    role: userRoleEnum("role").notNull().default("FARMER"),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    location: varchar("location", { length: 100 }),
    latitude: numeric("latitude", { precision: 10, scale: 8 }),
    longitude: numeric("longitude", { precision: 11, scale: 8 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true })
  },
  (table) => [index("users_role_idx").on(table.role)]
);
var produceListings = pgTable(
  "produce_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmerId: uuid("farmer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    produceType: varchar("produce_type", { length: 100 }).notNull(),
    category: produceCategoryEnum("category").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unit: unitTypeEnum("unit").notNull(),
    pricePerUnit: numeric("price_per_unit", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GHS"),
    location: varchar("location", { length: 100 }).notNull(),
    latitude: numeric("latitude", { precision: 10, scale: 8 }).notNull(),
    longitude: numeric("longitude", { precision: 11, scale: 8 }).notNull(),
    availableFrom: date("available_from").notNull(),
    availableTo: date("available_to").notNull(),
    isOrganic: boolean("is_organic").notNull().default(false),
    description: text("description"),
    status: listingStatusEnum("status").notNull().default("ACTIVE"),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("listings_produce_type_idx").on(table.produceType),
    index("listings_category_idx").on(table.category),
    index("listings_location_idx").on(table.location),
    index("listings_status_idx").on(table.status),
    index("listings_farmer_idx").on(table.farmerId),
    index("listings_availability_idx").on(table.availableFrom, table.availableTo),
    index("listings_geo_idx").on(table.latitude, table.longitude)
  ]
);
var listingImages = pgTable("listing_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id").notNull().references(() => produceListings.id, { onDelete: "cascade" }),
  url: varchar("url", { length: 500 }).notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0)
});
var conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerId: uuid("buyer_id").notNull().references(() => users.id),
    listingId: uuid("listing_id").notNull().references(() => produceListings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("conversations_buyer_listing_idx").on(table.buyerId, table.listingId)]
);
var messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull().references(() => users.id),
    content: text("content").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("messages_conversation_idx").on(table.conversationId, table.createdAt)]
);
var reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewerId: uuid("reviewer_id").notNull().references(() => users.id),
    revieweeId: uuid("reviewee_id").notNull().references(() => users.id),
    listingId: uuid("listing_id").notNull().references(() => produceListings.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("reviews_reviewer_listing_idx").on(table.reviewerId, table.listingId)]
);
var refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 hex of the refresh token (the raw token is never stored) */
    token: varchar("token", { length: 500 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("refresh_tokens_user_idx").on(table.userId)]
);
var usersRelations = relations(users, ({ many }) => ({
  listings: many(produceListings),
  sentMessages: many(messages),
  buyerConversations: many(conversations),
  reviewsGiven: many(reviews, { relationName: "reviewer" }),
  reviewsReceived: many(reviews, { relationName: "reviewee" }),
  refreshTokens: many(refreshTokens)
}));
var produceListingsRelations = relations(produceListings, ({ one, many }) => ({
  farmer: one(users, { fields: [produceListings.farmerId], references: [users.id] }),
  images: many(listingImages),
  conversations: many(conversations),
  reviews: many(reviews)
}));
var listingImagesRelations = relations(listingImages, ({ one }) => ({
  listing: one(produceListings, { fields: [listingImages.listingId], references: [produceListings.id] })
}));
var conversationsRelations = relations(conversations, ({ one, many }) => ({
  buyer: one(users, { fields: [conversations.buyerId], references: [users.id] }),
  listing: one(produceListings, { fields: [conversations.listingId], references: [produceListings.id] }),
  messages: many(messages)
}));
var messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] })
}));
var reviewsRelations = relations(reviews, ({ one }) => ({
  reviewer: one(users, { fields: [reviews.reviewerId], references: [users.id], relationName: "reviewer" }),
  reviewee: one(users, { fields: [reviews.revieweeId], references: [users.id], relationName: "reviewee" }),
  listing: one(produceListings, { fields: [reviews.listingId], references: [produceListings.id] })
}));

// src/db/index.ts
var migrationsFolder = [path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle"), path.resolve(process.cwd(), "drizzle")].find((p) => fs.existsSync(p)) ?? path.resolve(process.cwd(), "drizzle");
async function createNeon(url) {
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const { default: ws } = await import("ws");
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: url, max: 20, idleTimeoutMillis: 3e4 });
  const db2 = drizzle(pool, { schema: schema_exports });
  return {
    db: db2,
    kind: "neon",
    migrate: () => migrate(db2, { migrationsFolder }),
    close: () => pool.end()
  };
}
async function createPglite(inMemory) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  let client;
  let releaseLock = () => {
  };
  if (inMemory) {
    client = new PGlite();
  } else {
    const dir = path.resolve(config.database.dataDir, "pglite");
    fs.mkdirSync(dir, { recursive: true });
    releaseLock = acquireDirLock(path.resolve(config.database.dataDir, "pglite.lock"), dir);
    try {
      client = new PGlite(dir);
      await client.waitReady;
    } catch (err) {
      releaseLock();
      throw new Error(
        `The embedded database in ${dir} failed to start (${err.message}). This usually means the folder was damaged by a crash or by two servers using it at once. Stop every API process, move that folder aside (or delete it), and start again; migrations rebuild it and \`npm run db:seed\` restores the sample data.`
      );
    }
  }
  await client.waitReady;
  const db2 = drizzle(client, { schema: schema_exports });
  return {
    db: db2,
    kind: "pglite",
    migrate: () => migrate(db2, { migrationsFolder }),
    close: async () => {
      await client.close();
      releaseLock();
    }
  };
}
function acquireDirLock(lockFile, dir) {
  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return e.code === "EPERM";
    }
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(lockFile, String(process.pid), { flag: "wx" });
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      const owner = Number(fs.readFileSync(lockFile, "utf8").trim());
      if (owner && owner !== process.pid && alive(owner)) {
        throw new Error(
          `Another process (PID ${owner}) is already using the database in ${dir}. Stop it first (it is probably another "npm run dev" or "npm run db:seed"), then start this one again.`
        );
      }
      fs.rmSync(lockFile, { force: true });
      if (attempt === 1) throw e;
    }
  }
  const release = () => {
    try {
      if (fs.readFileSync(lockFile, "utf8").trim() === String(process.pid)) fs.rmSync(lockFile, { force: true });
    } catch {
    }
  };
  process.once("exit", release);
  return release;
}
async function createDriver() {
  const url = config.database.url;
  if (url && url !== "memory://") {
    logger.info("Database: Neon Postgres");
    return createNeon(url);
  }
  const inMemory = config.isTest || url === "memory://";
  logger.info(inMemory ? "Database: PGlite (in memory)" : `Database: PGlite (embedded Postgres, ${config.database.dataDir}/pglite)`);
  return createPglite(inMemory);
}
var driver = await createDriver();
var db = driver.db;
var dbKind = driver.kind;
var runMigrations = driver.migrate;
var closeDb = driver.close;

// src/config/redis.ts
var MemoryStore = class {
  data = /* @__PURE__ */ new Map();
  live(key) {
    const entry = this.data.get(key);
    if (!entry) return void 0;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return void 0;
    }
    return entry;
  }
  async get(key) {
    return this.live(key)?.value ?? null;
  }
  async set(key, value, options = {}) {
    const existing = this.live(key);
    const expiresAt = options.keepTtl && existing ? existing.expiresAt : options.ex ? Date.now() + options.ex * 1e3 : null;
    this.data.set(key, { value, expiresAt });
  }
  async del(key) {
    this.data.delete(key);
  }
  async exists(key) {
    return this.live(key) !== void 0;
  }
  async ttl(key) {
    const entry = this.live(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1e3));
  }
  async incr(key) {
    const entry = this.live(key);
    const next = (entry ? Number(entry.value) : 0) + 1;
    this.data.set(key, { value: String(next), expiresAt: entry ? entry.expiresAt : null });
    return next;
  }
  async expire(key, seconds) {
    const entry = this.live(key);
    if (entry) entry.expiresAt = Date.now() + seconds * 1e3;
  }
  async flushAll() {
    this.data.clear();
  }
};
async function createUpstashStore(url, token) {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url, token, automaticDeserialization: false });
  return {
    async get(key) {
      return await redis.get(key) ?? null;
    },
    async set(key, value, options = {}) {
      if (options.keepTtl) await redis.set(key, value, { keepTtl: true });
      else if (options.ex) await redis.set(key, value, { ex: options.ex });
      else await redis.set(key, value);
    },
    async del(key) {
      await redis.del(key);
    },
    async exists(key) {
      return await redis.exists(key) > 0;
    },
    async ttl(key) {
      return redis.ttl(key);
    },
    async incr(key) {
      return redis.incr(key);
    },
    async expire(key, seconds) {
      await redis.expire(key, seconds);
    },
    async flushAll() {
      await redis.flushdb();
    }
  };
}
async function createStore() {
  if (config.redis.url && config.redis.token) {
    logger.info("Key-value store: Upstash Redis");
    return createUpstashStore(config.redis.url, config.redis.token);
  }
  logger.info("Key-value store: in-process memory (set UPSTASH_REDIS_REST_URL/TOKEN to use Upstash)");
  return new MemoryStore();
}
var kv = await createStore();

// src/services/sms.service.ts
var SmsService = class {
  outbox = [];
  async sendOTP(phone, code) {
    await this.deliver(phone, `Your AgriMatch code is ${code}. It expires in 5 minutes.`);
  }
  async deliver(to, message) {
    if (!config.isProd) {
      this.outbox.push({ to, message, at: /* @__PURE__ */ new Date() });
      if (this.outbox.length > 50) this.outbox.shift();
    }
    logger.info(`SMS to ${to}: ${message}`);
  }
  /** Test helper: last OTP sent to a phone number */
  lastOtpFor(phone) {
    for (let i = this.outbox.length - 1; i >= 0; i--) {
      const sms = this.outbox[i];
      if (sms.to === phone) return /code is (\d{6})/.exec(sms.message)?.[1];
    }
    return void 0;
  }
};
var smsService = new SmsService();

// src/repositories/user.repository.ts
import { eq } from "drizzle-orm";
var UserRepository = class {
  async findById(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  }
  async findByPhone(phone) {
    const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return user ?? null;
  }
  async create(data) {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }
  async update(id, data) {
    const [user] = await db.update(users).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning();
    return user ?? null;
  }
};
var userRepository = new UserRepository();
function toProfile(user) {
  return {
    id: user.id,
    phone: user.phone,
    /** only set for the admin account */
    username: user.username,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    location: user.location,
    latitude: user.latitude === null ? null : Number(user.latitude),
    longitude: user.longitude === null ? null : Number(user.longitude),
    createdAt: user.createdAt
  };
}

// src/utils/errors.ts
var AppError = class extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = new.target.name;
  }
  statusCode;
  code;
  details;
};
var BadRequestError = class extends AppError {
  constructor(message = "Bad request", details) {
    super(400, "BAD_REQUEST", message, details);
  }
};
var ValidationError = class extends AppError {
  constructor(details, message = "Validation failed") {
    super(422, "VALIDATION_ERROR", message, details);
  }
};
var UnauthorizedError = class extends AppError {
  constructor(message = "Authentication required", code = "UNAUTHORIZED") {
    super(401, code, message);
  }
};
var ForbiddenError = class extends AppError {
  constructor(message = "You do not have permission to do that") {
    super(403, "FORBIDDEN", message);
  }
};
var NotFoundError = class extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
};
var ConflictError = class extends AppError {
  constructor(message = "Conflict") {
    super(409, "CONFLICT", message);
  }
};
var RateLimitError = class extends AppError {
  constructor(retryAfter, code = "RATE_LIMITED", message) {
    super(429, code, message ?? `Please wait ${retryAfter} seconds before trying again`, { retryAfter });
    this.retryAfter = retryAfter;
  }
  retryAfter;
};

// src/utils/phone.ts
function normalizePhone(input) {
  let cleaned = input.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("00")) cleaned = cleaned.slice(2);
  if (cleaned.startsWith("233")) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!/^[25]\d{8}$/.test(cleaned)) {
    throw new BadRequestError("Invalid phone number. Enter a Ghana mobile number, e.g. 024 123 4567.");
  }
  return `+233${cleaned}`;
}

// src/utils/crypto.ts
import { createHash, randomInt } from "node:crypto";
var sha256 = (value) => createHash("sha256").update(value).digest("hex");
var generateOtp = () => randomInt(1e5, 1e6).toString();

// src/services/auth.service.ts
var AuthService = class {
  async sendOTP(rawPhone) {
    const phone = normalizePhone(rawPhone);
    const { cooldownSeconds, ttlSeconds, maxPerHour } = config.otp;
    const lockKey = `otp:lock:${phone}`;
    if (await kv.exists(lockKey)) {
      throw new RateLimitError(await kv.ttl(lockKey), "OTP_LOCKED", "Too many wrong attempts. Try again later.");
    }
    const cooldownKey = `otp:cooldown:${phone}`;
    if (await kv.exists(cooldownKey)) {
      const wait = await kv.ttl(cooldownKey);
      throw new RateLimitError(wait, "OTP_RATE_LIMITED", `Please wait ${wait} seconds before requesting another OTP`);
    }
    const hourlyKey = `otp:hourly:${phone}`;
    const count2 = await kv.incr(hourlyKey);
    if (count2 === 1) await kv.expire(hourlyKey, 3600);
    if (count2 > maxPerHour) {
      const wait = Math.max(1, await kv.ttl(hourlyKey));
      throw new RateLimitError(wait, "OTP_RATE_LIMITED", "Too many codes requested. Try again later.");
    }
    const code = generateOtp();
    const data = { hash: await bcrypt.hash(code, 10), attempts: 0, createdAt: Date.now() };
    await kv.set(`otp:${phone}`, JSON.stringify(data), { ex: ttlSeconds });
    await kv.set(cooldownKey, "1", { ex: cooldownSeconds });
    await smsService.sendOTP(phone, code);
    return { phone, expiresIn: ttlSeconds, retryAfter: cooldownSeconds };
  }
  async verifyOTP(rawPhone, code) {
    const phone = normalizePhone(rawPhone);
    const { maxAttempts, lockSeconds } = config.otp;
    const lockKey = `otp:lock:${phone}`;
    if (await kv.exists(lockKey)) {
      throw new UnauthorizedError("Too many wrong attempts. Try again later.", "OTP_LOCKED");
    }
    const otpKey = `otp:${phone}`;
    const stored = await kv.get(otpKey);
    if (!stored) {
      throw new UnauthorizedError("Code expired or not found. Please request a new one.", "OTP_EXPIRED");
    }
    const otp2 = JSON.parse(stored);
    const valid = await bcrypt.compare(code, otp2.hash);
    if (!valid) {
      otp2.attempts += 1;
      if (otp2.attempts >= maxAttempts) {
        await kv.del(otpKey);
        await kv.set(lockKey, "1", { ex: lockSeconds });
        throw new UnauthorizedError("Too many wrong attempts. Locked for 30 minutes.", "OTP_LOCKED");
      }
      await kv.set(otpKey, JSON.stringify(otp2), { keepTtl: true });
      const remaining = maxAttempts - otp2.attempts;
      throw new UnauthorizedError(
        `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`,
        "OTP_INVALID"
      );
    }
    await kv.del(otpKey);
    let user = await userRepository.findByPhone(phone);
    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await userRepository.create({ phone, phoneVerified: true, lastLoginAt: /* @__PURE__ */ new Date() });
    } else {
      if (!user.isActive) throw new UnauthorizedError("This account is deactivated", "ACCOUNT_DISABLED");
      user = await userRepository.update(user.id, { phoneVerified: true, lastLoginAt: /* @__PURE__ */ new Date() });
    }
    const tokens = await this.issueTokens(user);
    return {
      user: { id: user.id, phone: user.phone, name: user.name, role: user.role, isNewUser },
      tokens
    };
  }
  /** Single-use refresh: the presented token is revoked and a new pair issued */
  async refreshAccessToken(refreshToken) {
    let payload;
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch {
      throw new UnauthorizedError("Invalid refresh token", "INVALID_REFRESH_TOKEN");
    }
    const hashed = sha256(refreshToken);
    const [stored] = await db.select().from(refreshTokens).where(eq2(refreshTokens.token, hashed)).limit(1);
    if (!stored) {
      if (payload.sub) await db.delete(refreshTokens).where(eq2(refreshTokens.userId, payload.sub));
      throw new UnauthorizedError("Refresh token expired or revoked", "INVALID_REFRESH_TOKEN");
    }
    if (stored.expiresAt < /* @__PURE__ */ new Date()) {
      await db.delete(refreshTokens).where(eq2(refreshTokens.id, stored.id));
      throw new UnauthorizedError("Refresh token expired or revoked", "INVALID_REFRESH_TOKEN");
    }
    await db.delete(refreshTokens).where(eq2(refreshTokens.id, stored.id));
    const user = await userRepository.findById(stored.userId);
    if (!user || !user.isActive) throw new UnauthorizedError("User not found", "INVALID_REFRESH_TOKEN");
    return this.issueTokens(user);
  }
  async logout(refreshToken) {
    if (!refreshToken) return;
    await db.delete(refreshTokens).where(eq2(refreshTokens.token, sha256(refreshToken)));
  }
  verifyAccessToken(token) {
    try {
      const p = jwt.verify(token, config.jwt.accessSecret);
      return { sub: String(p.sub), phone: String(p.phone), role: p.role };
    } catch {
      throw new UnauthorizedError("Invalid or expired access token", "INVALID_TOKEN");
    }
  }
  async issueTokens(user) {
    const accessToken = jwt.sign({ sub: user.id, phone: user.phone, role: user.role }, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessTtlSeconds
    });
    const refreshToken = jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshTtlSeconds
    });
    await db.insert(refreshTokens).values({
      userId: user.id,
      token: sha256(refreshToken),
      expiresAt: new Date(Date.now() + config.jwt.refreshTtlSeconds * 1e3)
    });
    return { accessToken, refreshToken, expiresIn: config.jwt.accessTtlSeconds };
  }
};
var authService = new AuthService();

// src/middleware/authenticate.ts
function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return req.cookies?.accessToken;
}
async function authenticate(req, _res, next) {
  const token = extractToken(req);
  if (!token) throw new UnauthorizedError("Authentication required");
  const payload = authService.verifyAccessToken(token);
  const user = await userRepository.findById(payload.sub);
  if (!user || !user.isActive) throw new UnauthorizedError("Account not found or deactivated", "INVALID_TOKEN");
  req.user = { sub: user.id, phone: user.phone, role: user.role };
  next();
}
function authorize(...roles) {
  return (req, _res, next) => {
    const role = req.user?.role;
    if (!role) throw new UnauthorizedError("Authentication required");
    if (role !== "ADMIN" && !roles.includes(role)) {
      throw new ForbiddenError(`This action is for ${roles.map((r) => r.toLowerCase()).join(" / ")} accounts`);
    }
    next();
  };
}
function requireAdmin(req, _res, next) {
  if (req.user?.role !== "ADMIN") throw new ForbiddenError("Administrators only");
  next();
}

// src/middleware/validate.ts
var formatIssues = (error, where) => error.issues.map((i) => ({ in: where, field: i.path.join(".") || void 0, message: i.message }));
function validate(schemas) {
  return (req, _res, next) => {
    const issues = [];
    for (const key of ["params", "query", "body"]) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key] ?? {});
      if (!result.success) {
        issues.push(...formatIssues(result.error, key));
        continue;
      }
      Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true, enumerable: true });
    }
    if (issues.length) throw new ValidationError(issues);
    next();
  };
}

// src/middleware/rateLimit.ts
function rateLimit({ name, max, windowSeconds: windowSeconds2 }) {
  return async (req, res, next) => {
    const who = req.user?.sub ?? req.ip ?? "unknown";
    const key = `rl:${name}:${who}`;
    const count2 = await kv.incr(key);
    if (count2 === 1) await kv.expire(key, windowSeconds2);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - count2)));
    if (count2 > max) {
      const retryAfter = Math.max(1, await kv.ttl(key));
      res.setHeader("Retry-After", String(retryAfter));
      throw new RateLimitError(retryAfter, "RATE_LIMITED", "Too many requests. Slow down and try again shortly.");
    }
    next();
  };
}

// src/middleware/upload.ts
import multer from "multer";

// src/services/image.service.ts
import fs2 from "node:fs/promises";
import path2 from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
var MAX_IMAGES_PER_LISTING = 5;
var root = () => path2.resolve(config.uploadDir);
var ImageService = class {
  /** Re-encode to WebP (max 1600px), which also strips EXIF/GPS metadata and rejects non-images */
  async saveListingImage(listingId, buffer) {
    const dir = path2.join(root(), "listings", listingId);
    await fs2.mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    try {
      await sharp(buffer).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(path2.join(dir, filename));
    } catch {
      throw new BadRequestError("One of the files is not a valid image (use JPEG, PNG or WebP).");
    }
    return `/uploads/listings/${listingId}/${filename}`;
  }
  async removeByUrl(url) {
    const rel = url.replace(/^\/uploads\//, "");
    const target = path2.resolve(root(), rel);
    if (!target.startsWith(root() + path2.sep)) return;
    await fs2.rm(target, { force: true });
  }
  async removeListingDir(listingId) {
    await fs2.rm(path2.join(root(), "listings", listingId), { recursive: true, force: true });
  }
};
var imageService = new ImageService();

// src/middleware/upload.ts
var MAX_BYTES = 5 * 1024 * 1024;
var uploadListingImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_IMAGES_PER_LISTING },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new BadRequestError("Only JPEG, PNG or WebP images are accepted"));
  }
}).array("images", MAX_IMAGES_PER_LISTING);

// src/controllers/auth.controller.ts
var REFRESH_PATH = "/v1/auth";
function setAuthCookies(res, tokens) {
  const base = { httpOnly: true, secure: config.isProd };
  res.cookie("accessToken", tokens.accessToken, {
    ...base,
    sameSite: "lax",
    path: "/",
    maxAge: config.jwt.accessTtlSeconds * 1e3
  });
  res.cookie("refreshToken", tokens.refreshToken, {
    ...base,
    sameSite: "strict",
    path: REFRESH_PATH,
    maxAge: config.jwt.refreshTtlSeconds * 1e3
  });
}
function clearAuthCookies(res) {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: REFRESH_PATH });
}
var readRefreshToken = (req) => req.cookies?.refreshToken ?? req.body?.refreshToken;
var authController = {
  async sendOtp(req, res) {
    const data = await authService.sendOTP(req.body.phone);
    res.json({ success: true, message: "OTP sent successfully", data });
  },
  async verifyOtp(req, res) {
    const { user, tokens } = await authService.verifyOTP(req.body.phone, req.body.code);
    setAuthCookies(res, tokens);
    res.json({ success: true, data: { user, tokens } });
  },
  async refresh(req, res) {
    const token = readRefreshToken(req);
    if (!token) throw new UnauthorizedError("Refresh token missing", "INVALID_REFRESH_TOKEN");
    const tokens = await authService.refreshAccessToken(token);
    setAuthCookies(res, tokens);
    res.json({ success: true, data: { tokens } });
  },
  async logout(req, res) {
    await authService.logout(readRefreshToken(req));
    clearAuthCookies(res);
    res.json({ success: true, message: "Signed out" });
  },
  async me(req, res) {
    const user = await userRepository.findById(req.user.sub);
    if (!user) throw new NotFoundError("User not found");
    res.json({ success: true, data: { user: toProfile(user) } });
  },
  async updateMe(req, res) {
    const input = req.body;
    const user = await userRepository.update(req.user.sub, {
      name: input.name,
      role: input.role,
      location: input.location,
      latitude: input.latitude === void 0 ? void 0 : String(input.latitude),
      longitude: input.longitude === void 0 ? void 0 : String(input.longitude)
    });
    if (!user) throw new NotFoundError("User not found");
    res.json({ success: true, data: { user: toProfile(user) } });
  }
};

// src/repositories/listing.repository.ts
import { and, asc, desc, eq as eq3, gte, inArray, lte, sql } from "drizzle-orm";
function toListingDto(listing) {
  return {
    id: listing.id,
    farmerId: listing.farmerId,
    produceType: listing.produceType,
    category: listing.category,
    quantity: Number(listing.quantity),
    unit: listing.unit,
    pricePerUnit: Number(listing.pricePerUnit),
    currency: listing.currency,
    location: listing.location,
    latitude: Number(listing.latitude),
    longitude: Number(listing.longitude),
    availableFrom: listing.availableFrom,
    availableTo: listing.availableTo,
    isOrganic: listing.isOrganic,
    description: listing.description,
    status: listing.status,
    viewCount: listing.viewCount,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt
  };
}
var likeEscape = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
var ListingRepository = class {
  async create(data) {
    const [listing] = await db.insert(produceListings).values(data).returning();
    return listing;
  }
  async findById(id) {
    const [row] = await db.select({
      listing: produceListings,
      farmer: { id: users.id, name: users.name, phone: users.phone, avatarUrl: users.avatarUrl }
    }).from(produceListings).innerJoin(users, eq3(produceListings.farmerId, users.id)).where(eq3(produceListings.id, id)).limit(1);
    if (!row) return null;
    const images = await this.imagesFor(id);
    return { ...row, images };
  }
  /** Raw row, no joins (ownership checks) */
  async findRaw(id) {
    const [listing] = await db.select().from(produceListings).where(eq3(produceListings.id, id)).limit(1);
    return listing ?? null;
  }
  async findAll(filters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;
    const conditions = [eq3(produceListings.status, filters.status ?? "ACTIVE")];
    if (filters.produce) {
      conditions.push(sql`${produceListings.produceType} ILIKE ${"%" + likeEscape(filters.produce) + "%"}`);
    }
    if (filters.category) conditions.push(eq3(produceListings.category, filters.category));
    if (filters.location) conditions.push(sql`lower(${produceListings.location}) = ${filters.location.toLowerCase()}`);
    if (filters.minQuantity !== void 0) conditions.push(gte(produceListings.quantity, String(filters.minQuantity)));
    if (filters.maxPrice !== void 0) conditions.push(lte(produceListings.pricePerUnit, String(filters.maxPrice)));
    if (filters.organic) conditions.push(eq3(produceListings.isOrganic, true));
    const where = and(...conditions);
    const order = filters.sort === "price_asc" ? [asc(produceListings.pricePerUnit), desc(produceListings.createdAt), asc(produceListings.id)] : filters.sort === "price_desc" ? [desc(produceListings.pricePerUnit), desc(produceListings.createdAt), asc(produceListings.id)] : [desc(produceListings.createdAt), asc(produceListings.id)];
    const [rows, totalRows] = await Promise.all([
      db.select({ listing: produceListings, farmer: { id: users.id, name: users.name } }).from(produceListings).innerJoin(users, eq3(produceListings.farmerId, users.id)).where(where).orderBy(...order).limit(limit).offset(offset),
      db.select({ count: sql`count(*)::int` }).from(produceListings).where(where)
    ]);
    const total = totalRows[0].count;
    const primary = await this.primaryImages(rows.map((r) => r.listing.id));
    return {
      items: rows.map((r) => ({
        ...toListingDto(r.listing),
        farmer: r.farmer,
        imageUrl: primary.get(r.listing.id) ?? null
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }
  async findByFarmer(farmerId) {
    const rows = await db.select().from(produceListings).where(eq3(produceListings.farmerId, farmerId)).orderBy(desc(produceListings.createdAt));
    const images = rows.length ? await db.select().from(listingImages).where(inArray(listingImages.listingId, rows.map((r) => r.id))).orderBy(asc(listingImages.sortOrder)) : [];
    return rows.map((r) => ({ ...toListingDto(r), images: images.filter((i) => i.listingId === r.id) }));
  }
  async update(id, data) {
    const [updated] = await db.update(produceListings).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(produceListings.id, id)).returning();
    return updated ?? null;
  }
  async delete(id) {
    await db.delete(produceListings).where(eq3(produceListings.id, id));
  }
  async incrementViewCount(id) {
    await db.update(produceListings).set({ viewCount: sql`${produceListings.viewCount} + 1` }).where(eq3(produceListings.id, id));
  }
  // ─── Images ────────────────────────────
  async imagesFor(listingId) {
    return db.select().from(listingImages).where(eq3(listingImages.listingId, listingId)).orderBy(asc(listingImages.sortOrder));
  }
  async primaryImages(listingIds) {
    const map = /* @__PURE__ */ new Map();
    if (!listingIds.length) return map;
    const rows = await db.select().from(listingImages).where(and(inArray(listingImages.listingId, listingIds), eq3(listingImages.isPrimary, true)));
    for (const row of rows) map.set(row.listingId, row.url);
    return map;
  }
  async addImages(listingId, items) {
    if (!items.length) return [];
    return db.insert(listingImages).values(items.map((i) => ({ ...i, listingId }))).returning();
  }
  async findImage(listingId, imageId) {
    const [img] = await db.select().from(listingImages).where(and(eq3(listingImages.id, imageId), eq3(listingImages.listingId, listingId))).limit(1);
    return img ?? null;
  }
  async deleteImage(imageId) {
    await db.delete(listingImages).where(eq3(listingImages.id, imageId));
  }
  async setPrimaryImage(listingId, imageId) {
    await db.update(listingImages).set({ isPrimary: false }).where(eq3(listingImages.listingId, listingId));
    await db.update(listingImages).set({ isPrimary: true }).where(eq3(listingImages.id, imageId));
  }
};
var listingRepository = new ListingRepository();

// src/utils/categories.ts
var PRODUCE_CATEGORIES = {
  tomatoes: "VEGETABLES",
  onions: "VEGETABLES",
  pepper: "VEGETABLES",
  okra: "VEGETABLES",
  "garden eggs": "VEGETABLES",
  cabbages: "VEGETABLES",
  carrots: "VEGETABLES",
  cassava: "VEGETABLES",
  yam: "VEGETABLES",
  cocoyam: "VEGETABLES",
  spinach: "VEGETABLES",
  pineapples: "FRUITS",
  mangoes: "FRUITS",
  plantain: "FRUITS",
  bananas: "FRUITS",
  oranges: "FRUITS",
  pawpaw: "FRUITS",
  watermelons: "FRUITS",
  avocados: "FRUITS",
  maize: "GRAINS",
  rice: "GRAINS",
  sorghum: "GRAINS",
  millet: "GRAINS",
  cowpeas: "LEGUMES",
  groundnuts: "LEGUMES",
  soybeans: "LEGUMES",
  "bambara beans": "LEGUMES",
  beans: "LEGUMES",
  milk: "DAIRY",
  eggs: "LIVESTOCK",
  goats: "LIVESTOCK",
  chickens: "LIVESTOCK"
};
function inferCategory(produceType) {
  return PRODUCE_CATEGORIES[produceType.trim().toLowerCase()] ?? "OTHER";
}

// src/utils/ghana.ts
var GHANA_CITIES = [
  { name: "Accra", region: "Greater Accra", latitude: 5.6037, longitude: -0.187 },
  { name: "Tema", region: "Greater Accra", latitude: 5.6698, longitude: -0.0166 },
  { name: "Kumasi", region: "Ashanti", latitude: 6.6885, longitude: -1.6244 },
  { name: "Tamale", region: "Northern", latitude: 9.4034, longitude: -0.8424 },
  { name: "Takoradi", region: "Western", latitude: 4.8845, longitude: -1.7554 },
  { name: "Cape Coast", region: "Central", latitude: 5.1053, longitude: -1.2466 },
  { name: "Sunyani", region: "Bono", latitude: 7.3349, longitude: -2.3123 },
  { name: "Techiman", region: "Bono East", latitude: 7.5833, longitude: -1.9333 },
  { name: "Ho", region: "Volta", latitude: 6.6008, longitude: 0.4713 },
  { name: "Koforidua", region: "Eastern", latitude: 6.0784, longitude: -0.2713 },
  { name: "Wa", region: "Upper West", latitude: 10.0601, longitude: -2.5099 },
  { name: "Bolgatanga", region: "Upper East", latitude: 10.7856, longitude: -0.8514 }
];
function findCity(name) {
  if (!name) return void 0;
  const n = name.trim().toLowerCase();
  return GHANA_CITIES.find((c) => c.name.toLowerCase() === n);
}

// src/services/listing.service.ts
var ListingService = class {
  async create(actor, input) {
    const coords = this.resolveCoordinates(input.location, input.latitude, input.longitude);
    const created = await listingRepository.create({
      farmerId: actor.sub,
      produceType: input.produceType,
      category: input.category ?? inferCategory(input.produceType),
      quantity: String(input.quantity),
      unit: input.unit,
      pricePerUnit: String(input.pricePerUnit),
      currency: input.currency,
      location: input.location,
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
      availableFrom: input.availableFrom,
      availableTo: input.availableTo,
      isOrganic: input.isOrganic,
      description: input.description ?? null
    });
    return toListingDto(created);
  }
  list(filters) {
    return listingRepository.findAll(filters);
  }
  mine(farmerId) {
    return listingRepository.findByFarmer(farmerId);
  }
  /** Full details incl. the farmer's phone (callers are authenticated). Views by others are counted. */
  async getById(id, viewerId) {
    const found = await listingRepository.findById(id);
    if (!found) throw new NotFoundError("Listing not found");
    if (found.listing.farmerId !== viewerId) {
      await listingRepository.incrementViewCount(id);
      found.listing.viewCount += 1;
    }
    return { ...toListingDto(found.listing), farmer: found.farmer, images: found.images };
  }
  async update(actor, id, input) {
    const existing = await this.requireOwned(actor, id);
    const patch = {};
    if (input.produceType !== void 0) patch.produceType = input.produceType;
    if (input.category !== void 0) patch.category = input.category;
    else if (input.produceType !== void 0) patch.category = inferCategory(input.produceType);
    if (input.quantity !== void 0) patch.quantity = String(input.quantity);
    if (input.unit !== void 0) patch.unit = input.unit;
    if (input.pricePerUnit !== void 0) patch.pricePerUnit = String(input.pricePerUnit);
    if (input.currency !== void 0) patch.currency = input.currency;
    if (input.isOrganic !== void 0) patch.isOrganic = input.isOrganic;
    if (input.description !== void 0) patch.description = input.description;
    if (input.status !== void 0) patch.status = input.status;
    if (input.location !== void 0 || input.latitude !== void 0 || input.longitude !== void 0) {
      const name = input.location ?? existing.location;
      const coords = input.latitude !== void 0 && input.longitude !== void 0 ? { latitude: input.latitude, longitude: input.longitude } : input.location !== void 0 ? this.resolveCoordinates(name, void 0, void 0) : { latitude: Number(existing.latitude), longitude: Number(existing.longitude) };
      patch.location = name;
      patch.latitude = String(coords.latitude);
      patch.longitude = String(coords.longitude);
    }
    const from = input.availableFrom ?? existing.availableFrom;
    const to = input.availableTo ?? existing.availableTo;
    if (input.availableFrom !== void 0 || input.availableTo !== void 0) {
      if (to < from) throw new BadRequestError("availableTo must be on or after availableFrom");
      patch.availableFrom = from;
      patch.availableTo = to;
    }
    const updated = await listingRepository.update(id, patch);
    return toListingDto(updated);
  }
  async remove(actor, id) {
    await this.requireOwned(actor, id);
    await listingRepository.delete(id);
    await imageService.removeListingDir(id);
  }
  // ─── Images ────────────────────────────
  async addImages(actor, id, files) {
    await this.requireOwned(actor, id);
    if (!files.length) throw new BadRequestError('Attach at least one image in the "images" field');
    const existing = await listingRepository.imagesFor(id);
    if (existing.length + files.length > MAX_IMAGES_PER_LISTING) {
      throw new BadRequestError(
        `A listing can have at most ${MAX_IMAGES_PER_LISTING} images (it has ${existing.length}).`
      );
    }
    const urls = [];
    try {
      for (const file of files) urls.push(await imageService.saveListingImage(id, file.buffer));
    } catch (err) {
      await Promise.all(urls.map((u) => imageService.removeByUrl(u)));
      throw err;
    }
    const start = existing.length ? Math.max(...existing.map((i) => i.sortOrder)) + 1 : 0;
    return listingRepository.addImages(
      id,
      urls.map((url, i) => ({ url, sortOrder: start + i, isPrimary: existing.length === 0 && i === 0 }))
    );
  }
  async removeImage(actor, listingId, imageId) {
    await this.requireOwned(actor, listingId);
    const image = await listingRepository.findImage(listingId, imageId);
    if (!image) throw new NotFoundError("Image not found");
    await listingRepository.deleteImage(imageId);
    await imageService.removeByUrl(image.url);
    if (image.isPrimary) {
      const remaining = await listingRepository.imagesFor(listingId);
      if (remaining.length) await listingRepository.setPrimaryImage(listingId, remaining[0].id);
    }
  }
  // ─── helpers ───────────────────────────
  async requireOwned(actor, id) {
    const listing = await listingRepository.findRaw(id);
    if (!listing) throw new NotFoundError("Listing not found");
    if (listing.farmerId !== actor.sub && actor.role !== "ADMIN") {
      throw new ForbiddenError("You can only change your own listings");
    }
    return listing;
  }
  /** Use explicit coordinates, else look the location up in the Ghana city table */
  resolveCoordinates(location, lat, lng) {
    if (lat !== void 0 && lng !== void 0) return { latitude: lat, longitude: lng };
    const city = findCity(location);
    if (!city) {
      throw new BadRequestError(
        `Unknown location "${location}". Send latitude and longitude, or use a known town (e.g. Accra, Kumasi, Tamale).`
      );
    }
    return { latitude: city.latitude, longitude: city.longitude };
  }
};
var listingService = new ListingService();

// src/controllers/listing.controller.ts
var listingController = {
  async create(req, res) {
    const listing = await listingService.create(req.user, req.body);
    res.status(201).json({ success: true, data: { listing } });
  },
  async list(req, res) {
    const data = await listingService.list(req.query);
    res.json({ success: true, data });
  },
  async mine(req, res) {
    const listings2 = await listingService.mine(req.user.sub);
    res.json({ success: true, data: { listings: listings2 } });
  },
  async get(req, res) {
    const listing = await listingService.getById(req.params.id, req.user.sub);
    res.json({ success: true, data: { listing } });
  },
  async update(req, res) {
    const listing = await listingService.update(req.user, req.params.id, req.body);
    res.json({ success: true, data: { listing } });
  },
  async remove(req, res) {
    await listingService.remove(req.user, req.params.id);
    res.json({ success: true, message: "Listing deleted" });
  },
  async addImages(req, res) {
    const files = req.files ?? [];
    const images = await listingService.addImages(req.user, req.params.id, files);
    res.status(201).json({ success: true, data: { images } });
  },
  async removeImage(req, res) {
    await listingService.removeImage(req.user, req.params.id, req.params.imgId);
    res.json({ success: true, message: "Image removed" });
  }
};

// src/services/admin.service.ts
import bcrypt2 from "bcryptjs";
import { and as and2, count, desc as desc2, eq as eq4, ilike, or, sql as sql2 } from "drizzle-orm";
var ADMIN_PHONE = "+233000000000";
var BCRYPT_COST = 12;
var DUMMY_HASH = bcrypt2.hashSync("not-a-real-password", 10);
var likeEscape2 = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
var AdminService = class {
  /** Create the admin account if it does not exist yet. An existing account (and any changed password) is left alone. */
  async ensureAdmin() {
    const { username, password } = config.admin;
    if (!password) {
      logger.warn("ADMIN_PASSWORD is not set: no admin account was created");
      return "disabled";
    }
    const [existing] = await db.select({ id: users.id }).from(users).where(eq4(users.username, username)).limit(1);
    if (existing) return "exists";
    await db.insert(users).values({
      phone: ADMIN_PHONE,
      phoneVerified: true,
      username,
      passwordHash: await bcrypt2.hash(password, BCRYPT_COST),
      name: "Administrator",
      role: "ADMIN"
    });
    logger.info(`Admin account created (username "${username}")`);
    if (config.admin.usingDevPassword) {
      logger.info(`Development admin credentials -> username: ${username}  password: ${password}`);
    }
    return "created";
  }
  async login(rawUsername, password) {
    const username = rawUsername.trim().toLowerCase();
    const lockKey = `admin:lock:${username}`;
    const failKey = `admin:fail:${username}`;
    if (await kv.exists(lockKey)) {
      const wait = await kv.ttl(lockKey);
      throw new RateLimitError(wait, "ADMIN_LOCKED", "Too many failed attempts. Try again later.");
    }
    const [user] = await db.select().from(users).where(eq4(sql2`lower(${users.username})`, username)).limit(1);
    const valid = await bcrypt2.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid || user.role !== "ADMIN" || !user.isActive) {
      const failures = await kv.incr(failKey);
      if (failures === 1) await kv.expire(failKey, config.admin.lockSeconds);
      if (failures >= config.admin.maxFailures) {
        await kv.set(lockKey, "1", { ex: config.admin.lockSeconds });
        await kv.del(failKey);
        throw new RateLimitError(config.admin.lockSeconds, "ADMIN_LOCKED", "Too many failed attempts. Try again later.");
      }
      throw new UnauthorizedError("Incorrect username or password", "INVALID_CREDENTIALS");
    }
    await kv.del(failKey);
    const updated = await userRepository.update(user.id, { lastLoginAt: /* @__PURE__ */ new Date() });
    const tokens = await authService.issueTokens(updated);
    return {
      user: { id: updated.id, phone: updated.phone, name: updated.name, role: updated.role, isNewUser: false },
      tokens
    };
  }
  async changePassword(adminId, currentPassword, newPassword) {
    const user = await userRepository.findById(adminId);
    if (!user?.passwordHash || !await bcrypt2.compare(currentPassword, user.passwordHash)) {
      throw new UnauthorizedError("Current password is incorrect", "INVALID_CREDENTIALS");
    }
    if (currentPassword === newPassword) throw new BadRequestError("Choose a password you have not used before");
    await userRepository.update(adminId, { passwordHash: await bcrypt2.hash(newPassword, BCRYPT_COST) });
    await db.delete(refreshTokens).where(eq4(refreshTokens.userId, adminId));
    return authService.issueTokens(await userRepository.findById(adminId));
  }
  // ─── Overview ──────────────────────────
  async stats() {
    const day = sql2`date_trunc('day', ${users.createdAt})`;
    const [byRole, byStatus, [userTotals], [totals], topProduce, signups] = await Promise.all([
      db.select({ role: users.role, n: count() }).from(users).groupBy(users.role),
      db.select({ status: produceListings.status, n: count() }).from(produceListings).groupBy(produceListings.status),
      db.select({
        total: count(),
        active: sql2`count(*) filter (where ${users.isActive})::int`,
        newLast7: sql2`count(*) filter (where ${users.createdAt} > now() - interval '7 days')::int`
      }).from(users),
      db.select({
        conversations: sql2`(select count(*) from ${conversations})::int`,
        messages: sql2`(select count(*) from ${messages})::int`,
        reviews: sql2`(select count(*) from ${reviews})::int`,
        views: sql2`coalesce((select sum(${produceListings.viewCount}) from ${produceListings}), 0)::int`
      }).from(sql2`(select 1) as one`),
      db.select({ produce: produceListings.produceType, n: count() }).from(produceListings).where(eq4(produceListings.status, "ACTIVE")).groupBy(produceListings.produceType).orderBy(desc2(count()), produceListings.produceType).limit(5),
      db.select({ day: sql2`to_char(${day}, 'YYYY-MM-DD')`, n: count() }).from(users).where(sql2`${users.createdAt} > now() - interval '14 days'`).groupBy(day).orderBy(day)
    ]);
    const roleCount = (r) => byRole.find((x) => x.role === r)?.n ?? 0;
    const statusCount = (s) => byStatus.find((x) => x.status === s)?.n ?? 0;
    return {
      users: {
        total: userTotals.total,
        active: userTotals.active,
        deactivated: userTotals.total - userTotals.active,
        newLast7Days: userTotals.newLast7,
        farmers: roleCount("FARMER"),
        buyers: roleCount("BUYER"),
        admins: roleCount("ADMIN")
      },
      listings: {
        total: byStatus.reduce((n, s) => n + s.n, 0),
        active: statusCount("ACTIVE"),
        sold: statusCount("SOLD"),
        expired: statusCount("EXPIRED"),
        deactivated: statusCount("DEACTIVATED")
      },
      activity: totals,
      topProduce: topProduce.map((t) => ({ produce: t.produce, listings: t.n })),
      signups: signups.map((s) => ({ day: s.day, count: s.n }))
    };
  }
  // ─── Users ─────────────────────────────
  async listUsers(f) {
    const conditions = [];
    if (f.role) conditions.push(eq4(users.role, f.role));
    if (f.status) conditions.push(eq4(users.isActive, f.status === "active"));
    if (f.search) {
      const like = `%${likeEscape2(f.search)}%`;
      conditions.push(or(ilike(users.name, like), ilike(users.phone, like), ilike(users.username, like)));
    }
    const where = conditions.length ? and2(...conditions) : void 0;
    const [rows, [{ total }]] = await Promise.all([
      db.select({
        user: users,
        // Qualified by hand: Drizzle omits table names in single-table selects, which would make this compare a listing to itself
        listingCount: sql2`(select count(*) from produce_listings pl where pl.farmer_id = "users"."id")::int`
      }).from(users).where(where).orderBy(desc2(users.createdAt)).limit(f.limit).offset((f.page - 1) * f.limit),
      db.select({ total: count() }).from(users).where(where)
    ]);
    return {
      items: rows.map((r) => ({
        ...toProfile(r.user),
        username: r.user.username,
        isActive: r.user.isActive,
        lastLoginAt: r.user.lastLoginAt,
        listingCount: r.listingCount
      })),
      pagination: { total, page: f.page, limit: f.limit, totalPages: Math.ceil(total / f.limit) }
    };
  }
  async updateUser(adminId, targetId, changes) {
    const target = await userRepository.findById(targetId);
    if (!target) throw new NotFoundError("User not found");
    if (target.id === adminId) {
      if (changes.isActive === false) throw new ForbiddenError("You cannot deactivate your own account");
      if (changes.role && changes.role !== target.role) throw new ForbiddenError("You cannot change your own role");
    }
    if (changes.role === "ADMIN" && target.role !== "ADMIN") {
      throw new ConflictError("Admin accounts are created through ADMIN_USERNAME / ADMIN_PASSWORD, not promoted");
    }
    if (target.role === "ADMIN" && changes.role && changes.role !== "ADMIN") {
      throw new ConflictError("An admin account cannot be turned into a regular account");
    }
    const updated = await userRepository.update(targetId, changes);
    if (changes.isActive === false) {
      await db.delete(refreshTokens).where(eq4(refreshTokens.userId, targetId));
    }
    return { ...toProfile(updated), isActive: updated.isActive };
  }
  // ─── Listings ──────────────────────────
  async listListings(f) {
    const conditions = [];
    if (f.status) conditions.push(eq4(produceListings.status, f.status));
    if (f.search) {
      const like = `%${likeEscape2(f.search)}%`;
      conditions.push(or(ilike(produceListings.produceType, like), ilike(produceListings.location, like), ilike(users.name, like)));
    }
    const where = conditions.length ? and2(...conditions) : void 0;
    const base = db.select({ n: count() }).from(produceListings).innerJoin(users, eq4(produceListings.farmerId, users.id));
    const [rows, [{ n: total }]] = await Promise.all([
      db.select({ listing: produceListings, farmer: { id: users.id, name: users.name, phone: users.phone } }).from(produceListings).innerJoin(users, eq4(produceListings.farmerId, users.id)).where(where).orderBy(desc2(produceListings.createdAt)).limit(f.limit).offset((f.page - 1) * f.limit),
      where ? base.where(where) : base
    ]);
    return {
      items: rows.map((r) => ({ ...toListingDto(r.listing), farmer: r.farmer })),
      pagination: { total, page: f.page, limit: f.limit, totalPages: Math.ceil(total / f.limit) }
    };
  }
  async setListingStatus(listingId, status2) {
    const [updated] = await db.update(produceListings).set({ status: status2, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(produceListings.id, listingId)).returning();
    if (!updated) throw new NotFoundError("Listing not found");
    return toListingDto(updated);
  }
  deleteListing(adminId, listingId) {
    return listingService.remove({ sub: adminId, role: "ADMIN" }, listingId);
  }
};
var adminService = new AdminService();

// src/controllers/admin.controller.ts
var adminController = {
  async login(req, res) {
    const { user, tokens } = await adminService.login(req.body.username, req.body.password);
    setAuthCookies(res, tokens);
    res.json({ success: true, data: { user, tokens } });
  },
  async changePassword(req, res) {
    const tokens = await adminService.changePassword(req.user.sub, req.body.currentPassword, req.body.newPassword);
    setAuthCookies(res, tokens);
    res.json({ success: true, message: "Password changed. Other sessions were signed out.", data: { tokens } });
  },
  async me(req, res) {
    const user = await userRepository.findById(req.user.sub);
    if (!user) throw new NotFoundError("User not found");
    res.json({ success: true, data: { user: { ...toProfile(user), username: user.username } } });
  },
  async stats(_req, res) {
    res.json({ success: true, data: await adminService.stats() });
  },
  async users(req, res) {
    res.json({ success: true, data: await adminService.listUsers(req.query) });
  },
  async updateUser(req, res) {
    res.json({ success: true, data: { user: await adminService.updateUser(req.user.sub, req.params.id, req.body) } });
  },
  async listings(req, res) {
    res.json({ success: true, data: await adminService.listListings(req.query) });
  },
  async setListingStatus(req, res) {
    res.json({ success: true, data: { listing: await adminService.setListingStatus(req.params.id, req.body.status) } });
  },
  async deleteListing(req, res) {
    await adminService.deleteListing(req.user.sub, req.params.id);
    res.json({ success: true, message: "Listing deleted" });
  }
};

// src/services/matching.service.ts
import { and as and3, eq as eq5 } from "drizzle-orm";

// src/utils/haversine.ts
var toRad = (deg) => deg * Math.PI / 180;
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// src/utils/levenshtein.ts
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

// src/services/matching.service.ts
var DEFAULT_WEIGHTS = { produce: 30, quantity: 20, location: 25, price: 15, availability: 10 };
var DAY_MS = 864e5;
var has = (n) => n !== null && n !== void 0 && Number.isFinite(n);
var MatchingService = class {
  async findMatches(query) {
    const weights = this.normalizeWeights(query.weights);
    let { latitude: latitude2, longitude: longitude2 } = query;
    if (!has(latitude2) || !has(longitude2)) {
      const city = findCity(query.location);
      if (city) ({ latitude: latitude2, longitude: longitude2 } = city);
    }
    const conditions = [eq5(produceListings.status, "ACTIVE")];
    if (query.organicOnly) conditions.push(eq5(produceListings.isOrganic, true));
    const rows = await db.select({
      listing: produceListings,
      farmer: { id: users.id, name: users.name, phone: users.phone, avatarUrl: users.avatarUrl }
    }).from(produceListings).innerJoin(users, eq5(produceListings.farmerId, users.id)).where(and3(...conditions));
    const needed = query.requiredBy ? new Date(query.requiredBy) : null;
    const scored = [];
    for (const { listing, farmer } of rows) {
      const produceScore = this.calcProduceScore(query.produce, listing.produceType);
      if (produceScore === 0 && query.produce) continue;
      const lat = Number(listing.latitude);
      const lng = Number(listing.longitude);
      const quantityScore = this.calcQuantityScore(query.quantity, Number(listing.quantity));
      const locationScore = this.calcLocationScore(latitude2, longitude2, lat, lng);
      const priceScore = this.calcPriceScore(query.maxPrice, Number(listing.pricePerUnit));
      const availabilityScore = this.calcAvailabilityScore(
        needed,
        new Date(listing.availableFrom),
        new Date(listing.availableTo)
      );
      const total = weights.produce * produceScore + weights.quantity * quantityScore + weights.location * locationScore + weights.price * priceScore + weights.availability * availabilityScore;
      scored.push({
        matchScore: Math.round(total * 1e3) / 1e3,
        matchPercentage: Math.round(total * 100),
        matchTier: this.classifyTier(total),
        distance: has(latitude2) && has(longitude2) ? Math.round(haversine(latitude2, longitude2, lat, lng)) : null,
        breakdown: {
          produceScore: Math.round(produceScore * 100),
          quantityScore: Math.round(quantityScore * 100),
          locationScore: Math.round(locationScore * 100),
          priceScore: Math.round(priceScore * 100),
          availabilityScore: Math.round(availabilityScore * 100)
        },
        listing: {
          id: listing.id,
          produceType: listing.produceType,
          category: listing.category,
          quantity: Number(listing.quantity),
          unit: listing.unit,
          pricePerUnit: Number(listing.pricePerUnit),
          currency: listing.currency,
          location: listing.location,
          latitude: lat,
          longitude: lng,
          availableFrom: listing.availableFrom,
          availableTo: listing.availableTo,
          isOrganic: listing.isOrganic,
          description: listing.description,
          farmer
        }
      });
    }
    scored.sort((a, b) => b.matchScore - a.matchScore || (a.distance ?? Infinity) - (b.distance ?? Infinity));
    const results = scored.slice(0, query.limit ?? 20).map((r, i) => ({ ...r, rank: i + 1 }));
    return { normalizedWeights: weights, results, totalMatches: scored.length };
  }
  /** Any scale in, weights summing to 1 out. Negative values count as 0; all-zero falls back to the defaults. */
  normalizeWeights(input) {
    const raw = { ...DEFAULT_WEIGHTS };
    if (input) {
      for (const key of Object.keys(DEFAULT_WEIGHTS)) {
        const v = input[key];
        if (v !== void 0) raw[key] = Number.isFinite(v) ? Math.max(0, v) : 0;
      }
    }
    let sum = raw.produce + raw.quantity + raw.location + raw.price + raw.availability;
    const source = sum > 0 ? raw : DEFAULT_WEIGHTS;
    sum = source.produce + source.quantity + source.location + source.price + source.availability;
    const round = (n) => Math.round(n / sum * 1e4) / 1e4;
    return {
      produce: round(source.produce),
      quantity: round(source.quantity),
      location: round(source.location),
      price: round(source.price),
      availability: round(source.availability)
    };
  }
  // ─── Scoring functions (section 7.3) ───
  calcProduceScore(query, listing) {
    if (!query) return 0.5;
    const q = query.toLowerCase().trim();
    const l = listing.toLowerCase().trim();
    if (!q) return 0.5;
    if (q === l) return 1;
    if (l.includes(q) || q.includes(l)) return 0.5;
    if (levenshtein(q, l) <= 2) return 0.3;
    return 0;
  }
  calcQuantityScore(need, have) {
    if (!need || need <= 0) return 0.7;
    if (have >= need) {
      const surplusRatio = (have - need) / need;
      return Math.max(0.3, 1 - 0.15 * surplusRatio);
    }
    return have / need;
  }
  calcLocationScore(buyerLat, buyerLng, farmerLat, farmerLng) {
    if (!has(buyerLat) || !has(buyerLng)) return 0.5;
    const dist = haversine(buyerLat, buyerLng, farmerLat, farmerLng);
    if (dist <= 10) return 1;
    if (dist <= 30) return 0.9;
    if (dist <= 50) return 0.75;
    if (dist <= 100) return 0.55;
    if (dist <= 200) return 0.35;
    if (dist <= 500) return 0.15;
    return 0.05;
  }
  calcPriceScore(maxBudget, askPrice) {
    if (!maxBudget || maxBudget <= 0) return 0.7;
    if (askPrice <= maxBudget) {
      const savingsRatio = (maxBudget - askPrice) / maxBudget;
      return Math.max(0.5, 1 - 0.25 * savingsRatio);
    }
    const overageRatio = (askPrice - maxBudget) / maxBudget;
    return Math.max(0, 1 - 1.5 * overageRatio);
  }
  calcAvailabilityScore(needed, from, to) {
    if (!needed || Number.isNaN(needed.getTime())) return 0.7;
    const n = needed.getTime();
    const f = from.getTime();
    const t = to.getTime();
    if (n >= f && n <= t) return 1;
    const gap = n < f ? (f - n) / DAY_MS : (n - t) / DAY_MS;
    if (gap <= 3) return 0.85;
    if (gap <= 7) return 0.65;
    if (gap <= 14) return 0.4;
    if (gap <= 30) return 0.2;
    return 0.05;
  }
  // ─── Tiers (section 7.4) ───
  classifyTier(score) {
    if (score >= 0.8) return "EXCELLENT";
    if (score >= 0.6) return "GOOD";
    if (score >= 0.4) return "FAIR";
    return "POOR";
  }
};
var matchingService = new MatchingService();

// src/services/analytics.service.ts
import { desc as desc3, eq as eq6, sql as sql3 } from "drizzle-orm";

// src/services/insights.ts
var UNIT_WORD = {
  KG: "kg",
  TONS: "ton",
  CRATES: "crate",
  BAGS_90KG: "bag",
  PIECES: "piece",
  LITRES: "litre",
  BUNCHES: "bunch"
};
var unitWord = (u) => UNIT_WORD[u] ?? u.toLowerCase();
var money = (n) => `GHS ${Number(n.toFixed(2)).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`;
var pct = (n) => `${Math.round(Math.abs(n))}%`;
var mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
function groupListings(rows) {
  const map = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const key = `${r.produceType.trim().toLowerCase()}|${r.unit}`;
    let g = map.get(key);
    if (!g) map.set(key, g = { key, produce: r.produceType.trim(), unit: r.unit, rows: [], avg: 0 });
    g.rows.push(r);
  }
  for (const g of map.values()) g.avg = mean(g.rows.map((r) => r.pricePerUnit));
  return [...map.values()].sort((a, b) => b.rows.length - a.rows.length || a.produce.localeCompare(b.produce));
}
function buildMatrix(rows, maxProduce = 4, maxTowns = 7) {
  const groups = groupListings(rows).slice(0, maxProduce);
  const townCount = /* @__PURE__ */ new Map();
  for (const r of rows) townCount.set(r.location, (townCount.get(r.location) ?? 0) + 1);
  const towns = [...townCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, maxTowns).map(([t]) => t);
  return {
    towns,
    rows: groups.map((g) => ({
      produce: g.produce,
      unit: g.unit,
      avgPrice: round2(g.avg),
      cells: towns.map((location) => {
        const here = g.rows.filter((r) => r.location === location);
        return { location, avgPrice: here.length ? round2(mean(here.map((r) => r.pricePerUnit))) : null, count: here.length };
      })
    }))
  };
}
function buildBalance(rows) {
  let considered = 0;
  let atOrBelow = 0;
  for (const g of groupListings(rows)) {
    if (g.rows.length < 2) continue;
    for (const r of g.rows) {
      considered++;
      if (r.pricePerUnit <= g.avg + 1e-9) atOrBelow++;
    }
  }
  return {
    total: rows.length,
    considered,
    atOrBelow,
    above: considered - atOrBelow,
    sharePct: considered ? Math.round(atOrBelow / considered * 100) : null
  };
}
var change = (now, before) => before > 0 ? (now - before) / before * 100 : null;
function weekChangePct(p) {
  return p.newLastWeek > 0 ? Math.round(change(p.newThisWeek, p.newLastWeek)) : null;
}
function buildInsights(rows, months, pulse, limit = 6) {
  const out = [];
  const groups = groupListings(rows);
  const prev = new Map(months.filter((m) => m.month === "previous").map((m) => [`${m.produceType.trim().toLowerCase()}|${m.unit}`, m]));
  let mover = null;
  for (const m of months.filter((x) => x.month === "current")) {
    const p = prev.get(`${m.produceType.trim().toLowerCase()}|${m.unit}`);
    const c = p ? change(m.avgPrice, p.avgPrice) : null;
    if (p && c !== null && Math.abs(c) >= 5 && (!mover || Math.abs(c) > Math.abs(mover.pctChange))) mover = { m, pctChange: c, before: p.avgPrice };
  }
  if (mover) {
    const up = mover.pctChange > 0;
    out.push({
      id: `mover-${mover.m.produceType}`,
      kind: "mover",
      tone: up ? "watch" : "good",
      trend: up ? "up" : "down",
      produce: mover.m.produceType,
      title: `${mover.m.produceType} ${up ? "up" : "down"} ${pct(mover.pctChange)} this month`,
      detail: `Average asking price is ${money(mover.m.avgPrice)} per ${unitWord(mover.m.unit)}, from ${money(mover.before)} last month.`
    });
  }
  let best = null;
  for (const g of groups) {
    if (g.rows.length < 3) continue;
    const byTown = /* @__PURE__ */ new Map();
    for (const r of g.rows) byTown.set(r.location, [...byTown.get(r.location) ?? [], r.pricePerUnit]);
    if (byTown.size < 2) continue;
    for (const [town, prices] of byTown) {
      const townAvg = mean(prices);
      const gap = (g.avg - townAvg) / g.avg * 100;
      if (gap >= 10 && (!best || gap > best.gap)) best = { g, town, townAvg, gap, towns: byTown.size };
    }
  }
  if (best) {
    out.push({
      id: `cheapest-${best.g.produce}`,
      kind: "cheapest-town",
      tone: "good",
      produce: best.g.produce,
      title: `${best.g.produce} is cheapest in ${best.town}`,
      detail: `${money(best.townAvg)} per ${unitWord(best.g.unit)} there, ${pct(best.gap)} under the ${money(best.g.avg)} average across ${best.towns} towns.`
    });
  }
  if (pulse.newThisWeek > 0) {
    const c = weekChangePct(pulse);
    out.push({
      id: "activity",
      kind: "activity",
      tone: "info",
      trend: c === null ? void 0 : c >= 0 ? "up" : "down",
      title: `${pulse.newThisWeek} new ${pulse.newThisWeek === 1 ? "listing" : "listings"} this week`,
      detail: c === null ? "Nothing was posted the week before, so there is nothing to compare with yet." : `${c >= 0 ? "Up" : "Down"} ${Math.abs(c)}% on last week (${pulse.newLastWeek}). ${c >= 0 ? "More choice for buyers." : "Supply is slowing."}`
    });
  }
  const premiums = [];
  for (const g of groups) {
    const org = g.rows.filter((r) => r.isOrganic).map((r) => r.pricePerUnit);
    const con = g.rows.filter((r) => !r.isOrganic).map((r) => r.pricePerUnit);
    if (org.length && con.length) premiums.push(change(mean(org), mean(con)));
  }
  if (premiums.length) {
    const p = mean(premiums);
    out.push({
      id: "organic",
      kind: "organic",
      tone: "info",
      title: Math.abs(p) < 2 ? "Organic costs about the same" : `Organic costs about ${pct(p)} ${p > 0 ? "more" : "less"}`,
      detail: `Based on ${premiums.length} ${premiums.length === 1 ? "produce" : "produce types"} with both organic and conventional listings.`
    });
  }
  let wide = null;
  for (const g of groups) {
    if (g.rows.length < 3) continue;
    const prices = g.rows.map((r) => r.pricePerUnit);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    if (lo > 0 && hi / lo >= 1.5 && (!wide || hi / lo > wide.hi / wide.lo)) wide = { g, lo, hi };
  }
  if (wide) {
    out.push({
      id: `spread-${wide.g.produce}`,
      kind: "spread",
      tone: "watch",
      produce: wide.g.produce,
      title: `Prices for ${wide.g.produce} vary a lot`,
      detail: `From ${money(wide.lo)} to ${money(wide.hi)} per ${unitWord(wide.g.unit)} across ${wide.g.rows.length} listings. Compare before you buy or set your price.`
    });
  }
  if (groups.length) {
    const top = groups[0];
    out.push({
      id: `top-${top.produce}`,
      kind: "top",
      tone: "info",
      produce: top.produce,
      title: `${top.produce} has the most listings`,
      detail: `${top.rows.length} active ${top.rows.length === 1 ? "listing" : "listings"}, averaging ${money(top.avg)} per ${unitWord(top.unit)}.`
    });
  }
  return out.slice(0, limit);
}
var round2 = (n) => Math.round(n * 100) / 100;

// src/services/analytics.service.ts
var PRICE_BUCKETS = [20, 40, 60, 80];
var AnalyticsService = class {
  async getMarketSummary() {
    const active = eq6(produceListings.status, "ACTIVE");
    const [[summary], [dist], recent] = await Promise.all([
      db.select({
        totalListings: sql3`count(*)::int`,
        uniqueProduce: sql3`count(distinct ${produceListings.produceType})::int`,
        uniqueLocations: sql3`count(distinct ${produceListings.location})::int`,
        avgPrice: sql3`coalesce(round(avg(${produceListings.pricePerUnit}), 2), 0)::float`
      }).from(produceListings).where(active),
      db.select({
        b0: sql3`count(*) filter (where ${produceListings.pricePerUnit} < ${PRICE_BUCKETS[0]})::int`,
        b1: sql3`count(*) filter (where ${produceListings.pricePerUnit} >= ${PRICE_BUCKETS[0]} and ${produceListings.pricePerUnit} < ${PRICE_BUCKETS[1]})::int`,
        b2: sql3`count(*) filter (where ${produceListings.pricePerUnit} >= ${PRICE_BUCKETS[1]} and ${produceListings.pricePerUnit} < ${PRICE_BUCKETS[2]})::int`,
        b3: sql3`count(*) filter (where ${produceListings.pricePerUnit} >= ${PRICE_BUCKETS[2]} and ${produceListings.pricePerUnit} < ${PRICE_BUCKETS[3]})::int`,
        b4: sql3`count(*) filter (where ${produceListings.pricePerUnit} >= ${PRICE_BUCKETS[3]})::int`
      }).from(produceListings).where(active),
      db.select({ listing: produceListings, farmerName: users.name }).from(produceListings).innerJoin(users, eq6(produceListings.farmerId, users.id)).where(active).orderBy(desc3(produceListings.createdAt)).limit(5)
    ]);
    return {
      ...summary,
      currency: "GHS",
      priceDistribution: [
        { range: `0-${PRICE_BUCKETS[0]}`, count: dist.b0 },
        { range: `${PRICE_BUCKETS[0]}-${PRICE_BUCKETS[1]}`, count: dist.b1 },
        { range: `${PRICE_BUCKETS[1]}-${PRICE_BUCKETS[2]}`, count: dist.b2 },
        { range: `${PRICE_BUCKETS[2]}-${PRICE_BUCKETS[3]}`, count: dist.b3 },
        { range: `${PRICE_BUCKETS[3]}+`, count: dist.b4 }
      ],
      recentListings: recent.map((r) => ({ ...toListingDto(r.listing), farmerName: r.farmerName }))
    };
  }
  /** Average / min / max asking price per produce + unit, across active listings */
  async getAveragePrices() {
    return db.select({
      produce: produceListings.produceType,
      unit: produceListings.unit,
      avgPrice: sql3`round(avg(${produceListings.pricePerUnit}), 2)::float`,
      minPrice: sql3`min(${produceListings.pricePerUnit})::float`,
      maxPrice: sql3`max(${produceListings.pricePerUnit})::float`,
      count: sql3`count(*)::int`
    }).from(produceListings).where(eq6(produceListings.status, "ACTIVE")).groupBy(produceListings.produceType, produceListings.unit).orderBy(produceListings.produceType);
  }
  /**
   * Monthly average asking price for one produce, from every listing ever posted (any status),
   * oldest first. Months with no listings are omitted.
   */
  async getPriceHistory(produce, months) {
    const month = sql3`to_char(date_trunc('month', ${produceListings.createdAt}), 'YYYY-MM')`;
    const since = sql3`date_trunc('month', now()) - make_interval(months => ${months - 1})`;
    const like = "%" + produce.replace(/[\\%_]/g, (c) => `\\${c}`) + "%";
    const rows = await db.select({
      month,
      avgPrice: sql3`round(avg(${produceListings.pricePerUnit}), 2)::float`,
      minPrice: sql3`min(${produceListings.pricePerUnit})::float`,
      maxPrice: sql3`max(${produceListings.pricePerUnit})::float`,
      listings: sql3`count(*)::int`
    }).from(produceListings).where(sql3`${produceListings.produceType} ILIKE ${like} AND ${produceListings.createdAt} >= ${since}`).groupBy(month).orderBy(month);
    return { produce, currency: "GHS", months, history: rows };
  }
  /**
   * Everything the Prices dashboard needs beyond the basic tables: listing activity, the produce-by-town
   * price map, the "priced at or below average" balance, and plain-language insights.
   * Reads the active listings once and works in memory (fine at this scale; move to SQL if listings reach the tens of thousands).
   */
  async getInsights() {
    const active = await db.select({
      produceType: produceListings.produceType,
      unit: produceListings.unit,
      location: produceListings.location,
      pricePerUnit: sql3`${produceListings.pricePerUnit}::float`,
      isOrganic: produceListings.isOrganic
    }).from(produceListings).where(eq6(produceListings.status, "ACTIVE"));
    const created = produceListings.createdAt;
    const [pulseRow] = await db.select({
      newToday: sql3`count(*) filter (where ${created} >= date_trunc('day', now()))::int`,
      newYesterday: sql3`count(*) filter (where ${created} >= date_trunc('day', now()) - interval '1 day' and ${created} < date_trunc('day', now()))::int`,
      newThisWeek: sql3`count(*) filter (where ${created} >= now() - interval '7 days')::int`,
      newLastWeek: sql3`count(*) filter (where ${created} >= now() - interval '14 days' and ${created} < now() - interval '7 days')::int`
    }).from(produceListings);
    const monthRows = await db.select({
      produceType: produceListings.produceType,
      unit: produceListings.unit,
      month: sql3`case when ${created} >= date_trunc('month', now()) then 'current' else 'previous' end`,
      avgPrice: sql3`avg(${produceListings.pricePerUnit})::float`,
      listings: sql3`count(*)::int`
    }).from(produceListings).where(sql3`${created} >= date_trunc('month', now()) - interval '1 month'`).groupBy(
      produceListings.produceType,
      produceListings.unit,
      sql3`case when ${created} >= date_trunc('month', now()) then 'current' else 'previous' end`
    );
    const pulse = pulseRow;
    return {
      currency: "GHS",
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      pulse: { ...pulse, weekChangePct: weekChangePct(pulse) },
      balance: buildBalance(active),
      matrix: buildMatrix(active),
      insights: buildInsights(active, monthRows, pulse)
    };
  }
  async getListingsByLocation() {
    return db.select({
      location: produceListings.location,
      count: sql3`count(*)::int`
    }).from(produceListings).where(eq6(produceListings.status, "ACTIVE")).groupBy(produceListings.location).orderBy(sql3`count(*) desc`, produceListings.location);
  }
};
var analyticsService = new AnalyticsService();

// src/repositories/conversation.repository.ts
import { and as and4, desc as desc4, eq as eq7, inArray as inArray2, isNull, lt, ne, or as or2, sql as sql4 } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
var ConversationRepository = class {
  async findByBuyerAndListing(buyerId, listingId) {
    const [row] = await db.select().from(conversations).where(and4(eq7(conversations.buyerId, buyerId), eq7(conversations.listingId, listingId))).limit(1);
    return row ?? null;
  }
  async create(buyerId, listingId) {
    const [row] = await db.insert(conversations).values({ buyerId, listingId }).returning();
    return row;
  }
  /** Conversation plus the listing's farmer, for participant checks */
  async findWithParties(id) {
    const [row] = await db.select({
      id: conversations.id,
      buyerId: conversations.buyerId,
      listingId: conversations.listingId,
      farmerId: produceListings.farmerId,
      createdAt: conversations.createdAt
    }).from(conversations).innerJoin(produceListings, eq7(conversations.listingId, produceListings.id)).where(eq7(conversations.id, id)).limit(1);
    return row ?? null;
  }
  /** All conversations a user is in (as buyer, or as the farmer who owns the listing) */
  async listForUser(userId) {
    const buyer = alias(users, "buyer");
    const farmer = alias(users, "farmer");
    const rows = await db.select({
      id: conversations.id,
      createdAt: conversations.createdAt,
      listing: {
        id: produceListings.id,
        produceType: produceListings.produceType,
        pricePerUnit: produceListings.pricePerUnit,
        currency: produceListings.currency,
        location: produceListings.location
      },
      buyer: { id: buyer.id, name: buyer.name },
      farmer: { id: farmer.id, name: farmer.name }
    }).from(conversations).innerJoin(produceListings, eq7(conversations.listingId, produceListings.id)).innerJoin(buyer, eq7(conversations.buyerId, buyer.id)).innerJoin(farmer, eq7(produceListings.farmerId, farmer.id)).where(or2(eq7(conversations.buyerId, userId), eq7(produceListings.farmerId, userId)));
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [lastRows, unreadRows] = await Promise.all([
      db.execute(sql4`
        select distinct on (conversation_id) id, conversation_id as "conversationId", sender_id as "senderId",
               content, created_at as "createdAt"
        from messages
        where conversation_id in (${sql4.join(ids.map((i) => sql4`${i}`), sql4`, `)})
        order by conversation_id, created_at desc
      `),
      db.select({ conversationId: messages.conversationId, unread: sql4`count(*)::int` }).from(messages).where(and4(inArray2(messages.conversationId, ids), ne(messages.senderId, userId), isNull(messages.readAt))).groupBy(messages.conversationId)
    ]);
    const lastBy = /* @__PURE__ */ new Map();
    for (const m of lastRows.rows) lastBy.set(m.conversationId, m);
    const unreadBy = new Map(unreadRows.map((u) => [u.conversationId, u.unread]));
    return rows.map((r) => {
      const last = lastBy.get(r.id) ?? null;
      return {
        id: r.id,
        createdAt: r.createdAt,
        listing: { ...r.listing, pricePerUnit: Number(r.listing.pricePerUnit) },
        buyer: r.buyer,
        farmer: r.farmer,
        lastMessage: last ? { id: last.id, senderId: last.senderId, content: last.content, createdAt: new Date(last.createdAt) } : null,
        unreadCount: unreadBy.get(r.id) ?? 0
      };
    }).sort(
      (a, b) => (b.lastMessage?.createdAt ?? b.createdAt).getTime() - (a.lastMessage?.createdAt ?? a.createdAt).getTime()
    );
  }
  /** Newest `limit` messages (optionally older than `before`), returned oldest first */
  async listMessages(conversationId, limit, before) {
    const conditions = [eq7(messages.conversationId, conversationId)];
    if (before) conditions.push(lt(messages.createdAt, before));
    const rows = await db.select().from(messages).where(and4(...conditions)).orderBy(desc4(messages.createdAt), desc4(messages.id)).limit(limit);
    return rows.reverse();
  }
  async createMessage(conversationId, senderId, content2) {
    const [row] = await db.insert(messages).values({ conversationId, senderId, content: content2 }).returning();
    return row;
  }
  /** Marks everything the other person sent as read; returns how many changed */
  async markRead(conversationId, readerId) {
    const updated = await db.update(messages).set({ readAt: /* @__PURE__ */ new Date() }).where(and4(eq7(messages.conversationId, conversationId), ne(messages.senderId, readerId), isNull(messages.readAt))).returning({ id: messages.id });
    return updated.length;
  }
};
var conversationRepository = new ConversationRepository();

// src/websocket/index.ts
import { Server } from "socket.io";
function readCookie(header, name) {
  if (!header) return void 0;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return void 0;
}
var Realtime = class {
  io = null;
  attach(server) {
    const io = new Server(server, {
      cors: { origin: config.corsOrigins, credentials: true }
    });
    io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token ?? readCookie(socket.handshake.headers.cookie, "accessToken");
        if (!token) return next(new Error("UNAUTHORIZED"));
        socket.data.user = authService.verifyAccessToken(token);
        next();
      } catch {
        next(new Error("UNAUTHORIZED"));
      }
    });
    io.on("connection", (socket) => {
      socket.join(`user:${socket.data.user.sub}`);
      logger.debug(`socket connected: ${socket.data.user.sub}`);
    });
    this.io = io;
    return io;
  }
  emitToUsers(userIds, event, payload) {
    if (!this.io) return;
    for (const id of new Set(userIds)) this.io.to(`user:${id}`).emit(event, payload);
  }
  async close() {
    await this.io?.close();
    this.io = null;
  }
};
var realtime = new Realtime();

// src/services/messaging.service.ts
var MessagingService = class {
  /** A buyer opens (or re-opens) a conversation about a listing, optionally with a first message */
  async start(buyerId, listingId, firstMessage) {
    const listing = await listingRepository.findRaw(listingId);
    if (!listing) throw new NotFoundError("Listing not found");
    if (listing.farmerId === buyerId) throw new ForbiddenError("You cannot start a conversation about your own listing");
    let conversation = await conversationRepository.findByBuyerAndListing(buyerId, listingId);
    const created = !conversation;
    if (!conversation) conversation = await conversationRepository.create(buyerId, listingId);
    const message = firstMessage ? await this.deliver(conversation.id, buyerId, listing.farmerId, firstMessage) : null;
    return { conversation, message, created };
  }
  list(userId) {
    return conversationRepository.listForUser(userId);
  }
  async getMessages(userId, conversationId, limit, before) {
    await this.requireParticipant(userId, conversationId);
    return conversationRepository.listMessages(conversationId, limit, before);
  }
  async send(userId, conversationId, content2) {
    const convo = await this.requireParticipant(userId, conversationId);
    const recipient = convo.buyerId === userId ? convo.farmerId : convo.buyerId;
    return this.deliver(conversationId, userId, recipient, content2);
  }
  async markRead(userId, conversationId) {
    const convo = await this.requireParticipant(userId, conversationId);
    const updated = await conversationRepository.markRead(conversationId, userId);
    if (updated > 0) {
      const other = convo.buyerId === userId ? convo.farmerId : convo.buyerId;
      realtime.emitToUsers([other], "messages:read", { conversationId, readerId: userId });
    }
    return { updated };
  }
  async deliver(conversationId, senderId, recipientId, content2) {
    const message = await conversationRepository.createMessage(conversationId, senderId, content2);
    realtime.emitToUsers([senderId, recipientId], "message:new", message);
    return message;
  }
  async requireParticipant(userId, conversationId) {
    const convo = await conversationRepository.findWithParties(conversationId);
    if (!convo) throw new NotFoundError("Conversation not found");
    if (convo.buyerId !== userId && convo.farmerId !== userId) {
      throw new NotFoundError("Conversation not found");
    }
    return convo;
  }
};
var messagingService = new MessagingService();

// src/services/review.service.ts
import { and as and5, desc as desc5, eq as eq8, sql as sql5 } from "drizzle-orm";
var ReviewService = class {
  /**
   * Rate the other party of a deal. Only people who had a conversation about the listing can review,
   * a buyer reviews the farmer and a farmer reviews the buyer, once per listing.
   */
  async create(reviewerId, input) {
    const listing = await listingRepository.findRaw(input.listingId);
    if (!listing) throw new NotFoundError("Listing not found");
    let revieweeId;
    if (listing.farmerId === reviewerId) {
      if (!input.buyerId) throw new ForbiddenError("buyerId is required when a farmer leaves a review");
      const convo = await conversationRepository.findByBuyerAndListing(input.buyerId, listing.id);
      if (!convo) throw new ForbiddenError("That buyer has not contacted you about this listing");
      revieweeId = input.buyerId;
    } else {
      const convo = await conversationRepository.findByBuyerAndListing(reviewerId, listing.id);
      if (!convo) throw new ForbiddenError("You can only review a farmer you have contacted about this listing");
      revieweeId = listing.farmerId;
    }
    const [existing] = await db.select({ id: reviews.id }).from(reviews).where(and5(eq8(reviews.reviewerId, reviewerId), eq8(reviews.listingId, listing.id))).limit(1);
    if (existing) throw new ConflictError("You have already reviewed this listing");
    const [created] = await db.insert(reviews).values({ reviewerId, revieweeId, listingId: listing.id, rating: input.rating, comment: input.comment ?? null }).returning();
    return created;
  }
  async forUser(userId) {
    const rows = await db.select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      listingId: reviews.listingId,
      createdAt: reviews.createdAt,
      reviewer: { id: users.id, name: users.name }
    }).from(reviews).innerJoin(users, eq8(reviews.reviewerId, users.id)).where(eq8(reviews.revieweeId, userId)).orderBy(desc5(reviews.createdAt));
    const [agg] = await db.select({ avg: sql5`coalesce(round(avg(${reviews.rating}), 2), 0)::float`, count: sql5`count(*)::int` }).from(reviews).where(eq8(reviews.revieweeId, userId));
    return { averageRating: agg.avg, count: agg.count, reviews: rows };
  }
};
var reviewService = new ReviewService();

// src/controllers/market.controller.ts
var matchController = {
  async match(req, res) {
    const data = await matchingService.findMatches(req.body);
    res.json({ success: true, data });
  }
};
var analyticsController = {
  async summary(_req, res) {
    res.json({ success: true, data: await analyticsService.getMarketSummary() });
  },
  async prices(_req, res) {
    res.json({ success: true, data: { prices: await analyticsService.getAveragePrices() } });
  },
  async priceHistory(req, res) {
    const months = req.query.months;
    res.json({ success: true, data: await analyticsService.getPriceHistory(req.params.produce, months) });
  },
  async insights(_req, res) {
    res.json({ success: true, data: await analyticsService.getInsights() });
  },
  async locations(_req, res) {
    res.json({ success: true, data: { locations: await analyticsService.getListingsByLocation() } });
  }
};
var conversationController = {
  async start(req, res) {
    const result = await messagingService.start(req.user.sub, req.body.listingId, req.body.message);
    res.status(result.created ? 201 : 200).json({ success: true, data: result });
  },
  async list(req, res) {
    res.json({ success: true, data: { conversations: await messagingService.list(req.user.sub) } });
  },
  async messages(req, res) {
    const { limit, before } = req.query;
    const messages2 = await messagingService.getMessages(
      req.user.sub,
      req.params.id,
      limit,
      before ? new Date(before) : void 0
    );
    res.json({ success: true, data: { messages: messages2 } });
  },
  async send(req, res) {
    const message = await messagingService.send(req.user.sub, req.params.id, req.body.content);
    res.status(201).json({ success: true, data: { message } });
  },
  async markRead(req, res) {
    res.json({ success: true, data: await messagingService.markRead(req.user.sub, req.params.id) });
  }
};
var reviewController = {
  async create(req, res) {
    const review = await reviewService.create(req.user.sub, req.body);
    res.status(201).json({ success: true, data: { review } });
  },
  async forUser(req, res) {
    res.json({ success: true, data: await reviewService.forUser(req.params.userId) });
  }
};

// src/validations/auth.ts
import { z as z3 } from "zod";

// src/validations/common.ts
import { z as z2 } from "zod";
var uuidParam = z2.object({ id: z2.string().uuid("Invalid id") });
var isoDate = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD").refine((s) => {
  const d = /* @__PURE__ */ new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "Not a valid date");
var queryBool = z2.preprocess((v) => {
  if (typeof v === "string") {
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
  }
  return v;
}, z2.boolean());
var latitude = z2.number().min(-90).max(90);
var longitude = z2.number().min(-180).max(180);

// src/validations/auth.ts
var sendOtpSchema = z3.object({
  phone: z3.string().trim().min(7, "Enter a phone number").max(20)
});
var verifyOtpSchema = z3.object({
  phone: z3.string().trim().min(7).max(20),
  code: z3.string().regex(/^\d{6}$/, "The code is 6 digits")
});
var refreshSchema = z3.object({
  refreshToken: z3.string().min(10).optional()
});
var updateMeSchema = z3.object({
  name: z3.string().trim().min(2, "Name is too short").max(100).optional(),
  // ADMIN cannot be self-assigned
  role: z3.enum(["FARMER", "BUYER"]).optional(),
  location: z3.string().trim().min(2).max(100).optional(),
  latitude: latitude.optional(),
  longitude: longitude.optional()
}).refine((v) => Object.keys(v).length > 0, { message: "Send at least one field to update" }).refine((v) => v.latitude === void 0 === (v.longitude === void 0), {
  message: "latitude and longitude must be sent together",
  path: ["latitude"]
});

// src/validations/listing.ts
import { z as z4 } from "zod";
var category = z4.enum(produceCategoryEnum.enumValues);
var unit = z4.enum(unitTypeEnum.enumValues);
var status = z4.enum(listingStatusEnum.enumValues);
var baseFields = {
  produceType: z4.string().trim().min(2).max(100),
  category: category.optional(),
  quantity: z4.number().positive().max(9999999999),
  unit,
  pricePerUnit: z4.number().positive().max(99999999),
  currency: z4.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code").default("GHS"),
  location: z4.string().trim().min(2).max(100),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  availableFrom: isoDate,
  availableTo: isoDate,
  isOrganic: z4.boolean().default(false),
  description: z4.string().trim().max(2e3).nullish().transform((v) => v ?? void 0)
};
var coordsTogether = (v) => v.latitude === void 0 === (v.longitude === void 0);
var createListingSchema = z4.object(baseFields).refine(coordsTogether, { message: "latitude and longitude must be sent together", path: ["latitude"] }).refine((v) => v.availableTo >= v.availableFrom, {
  message: "availableTo must be on or after availableFrom",
  path: ["availableTo"]
});
var updateListingSchema = z4.object({
  produceType: baseFields.produceType,
  category,
  quantity: baseFields.quantity,
  unit,
  pricePerUnit: baseFields.pricePerUnit,
  currency: z4.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  location: baseFields.location,
  latitude,
  longitude,
  availableFrom: isoDate,
  availableTo: isoDate,
  isOrganic: z4.boolean(),
  description: z4.string().trim().max(2e3).nullable(),
  status
}).partial().refine((v) => Object.keys(v).length > 0, { message: "Send at least one field to update" }).refine(coordsTogether, { message: "latitude and longitude must be sent together", path: ["latitude"] }).refine((v) => !v.availableFrom || !v.availableTo || v.availableTo >= v.availableFrom, {
  message: "availableTo must be on or after availableFrom",
  path: ["availableTo"]
});
var listingQuerySchema = z4.object({
  produce: z4.string().trim().min(1).max(100).optional(),
  category: category.optional(),
  location: z4.string().trim().min(1).max(100).optional(),
  minQuantity: z4.coerce.number().nonnegative().optional(),
  maxPrice: z4.coerce.number().nonnegative().optional(),
  organic: queryBool.optional(),
  status: status.optional(),
  sort: z4.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  page: z4.coerce.number().int().min(1).default(1),
  limit: z4.coerce.number().int().min(1).max(100).default(20)
});
var listingImageParams = z4.object({
  id: z4.string().uuid("Invalid id"),
  imgId: z4.string().uuid("Invalid image id")
});

// src/validations/match.ts
import { z as z5 } from "zod";
var weight = z5.number().min(0).max(1e3);
var matchSchema = z5.object({
  produce: z5.string().trim().max(100).optional(),
  quantity: z5.number().positive().optional(),
  maxPrice: z5.number().positive().optional(),
  location: z5.string().trim().max(100).optional(),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  requiredBy: isoDate.optional(),
  organicOnly: z5.boolean().default(false),
  weights: z5.object({
    produce: weight.optional(),
    quantity: weight.optional(),
    location: weight.optional(),
    price: weight.optional(),
    availability: weight.optional()
  }).strict().optional(),
  limit: z5.number().int().min(1).max(100).default(20)
}).refine((v) => v.latitude === void 0 === (v.longitude === void 0), {
  message: "latitude and longitude must be sent together",
  path: ["latitude"]
});

// src/validations/admin.ts
import { z as z6 } from "zod";
var adminLoginSchema = z6.object({
  username: z6.string().trim().min(1, "Enter your username").max(50),
  password: z6.string().min(1, "Enter your password").max(200)
});
var adminUsersQuerySchema = z6.object({
  search: z6.string().trim().min(1).max(100).optional(),
  role: z6.enum(userRoleEnum.enumValues).optional(),
  status: z6.enum(["active", "inactive"]).optional(),
  page: z6.coerce.number().int().min(1).default(1),
  limit: z6.coerce.number().int().min(1).max(100).default(20)
});
var adminUpdateUserSchema = z6.object({
  isActive: z6.boolean().optional(),
  role: z6.enum(userRoleEnum.enumValues).optional()
}).refine((v) => Object.keys(v).length > 0, { message: "Send isActive or role" });
var adminListingsQuerySchema = z6.object({
  search: z6.string().trim().min(1).max(100).optional(),
  status: z6.enum(listingStatusEnum.enumValues).optional(),
  page: z6.coerce.number().int().min(1).default(1),
  limit: z6.coerce.number().int().min(1).max(100).default(20)
});
var adminListingStatusSchema = z6.object({ status: z6.enum(listingStatusEnum.enumValues) });
var changePasswordSchema = z6.object({
  currentPassword: z6.string().min(1).max(200),
  newPassword: z6.string().min(12, "Use at least 12 characters").max(100).refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), "Use upper and lower case letters and a number")
});

// src/validations/messaging.ts
import { z as z7 } from "zod";
var content = z7.string().trim().min(1, "Message cannot be empty").max(2e3);
var startConversationSchema = z7.object({
  listingId: z7.string().uuid("Invalid listing id"),
  message: content.optional()
});
var sendMessageSchema = z7.object({ content });
var messagesQuerySchema = z7.object({
  limit: z7.coerce.number().int().min(1).max(100).default(50),
  /** ISO timestamp: only messages older than this (for paging back) */
  before: z7.string().datetime({ offset: true }).optional()
});
var priceHistoryQuerySchema = z7.object({
  months: z7.coerce.number().int().min(1).max(24).default(6)
});
var createReviewSchema = z7.object({
  listingId: z7.string().uuid("Invalid listing id"),
  /** Required when the reviewer is the listing's farmer */
  buyerId: z7.string().uuid().optional(),
  rating: z7.number().int().min(1).max(5),
  comment: z7.string().trim().max(1e3).optional()
});
var userIdParam = z7.object({ userId: z7.string().uuid("Invalid user id") });
var produceParam = z7.object({ produce: z7.string().trim().min(1).max(100) });

// src/routes/index.ts
var { windowSeconds, general, otp } = config.rateLimit;
var v1 = Router();
v1.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", database: dbKind, uptime: Math.round(process.uptime()) } });
});
var auth = Router();
var otpLimit = rateLimit({ name: "otp", max: otp, windowSeconds });
auth.post("/otp/send", otpLimit, validate({ body: sendOtpSchema }), authController.sendOtp);
auth.post("/otp/verify", otpLimit, validate({ body: verifyOtpSchema }), authController.verifyOtp);
auth.post("/refresh", validate({ body: refreshSchema }), authController.refresh);
auth.post("/logout", validate({ body: refreshSchema }), authController.logout);
auth.get("/me", authenticate, authController.me);
auth.patch("/me", authenticate, validate({ body: updateMeSchema }), authController.updateMe);
v1.use("/auth", auth);
v1.post("/admin/auth/login", rateLimit({ name: "admin-login", max: config.isTest ? 1e6 : 10, windowSeconds }), validate({ body: adminLoginSchema }), adminController.login);
v1.use(authenticate, rateLimit({ name: "api", max: general, windowSeconds }));
var listings = Router();
listings.post("/", authorize("FARMER"), validate({ body: createListingSchema }), listingController.create);
listings.get("/", validate({ query: listingQuerySchema }), listingController.list);
listings.get("/my", authorize("FARMER"), listingController.mine);
listings.get("/:id", validate({ params: uuidParam }), listingController.get);
listings.patch("/:id", authorize("FARMER"), validate({ params: uuidParam, body: updateListingSchema }), listingController.update);
listings.delete("/:id", authorize("FARMER"), validate({ params: uuidParam }), listingController.remove);
listings.post("/:id/images", authorize("FARMER"), validate({ params: uuidParam }), uploadListingImages, listingController.addImages);
listings.delete("/:id/images/:imgId", authorize("FARMER"), validate({ params: listingImageParams }), listingController.removeImage);
v1.use("/listings", listings);
v1.post("/match", validate({ body: matchSchema }), matchController.match);
var analytics = Router();
analytics.get("/summary", analyticsController.summary);
analytics.get("/prices", analyticsController.prices);
analytics.get("/prices/:produce", validate({ params: produceParam, query: priceHistoryQuerySchema }), analyticsController.priceHistory);
analytics.get("/locations", analyticsController.locations);
analytics.get("/insights", analyticsController.insights);
v1.use("/analytics", analytics);
var conversations2 = Router();
conversations2.post("/", validate({ body: startConversationSchema }), conversationController.start);
conversations2.get("/", conversationController.list);
conversations2.get("/:id/messages", validate({ params: uuidParam, query: messagesQuerySchema }), conversationController.messages);
conversations2.post("/:id/messages", validate({ params: uuidParam, body: sendMessageSchema }), conversationController.send);
conversations2.patch("/:id/read", validate({ params: uuidParam }), conversationController.markRead);
v1.use("/conversations", conversations2);
var reviews2 = Router();
reviews2.post("/", validate({ body: createReviewSchema }), reviewController.create);
reviews2.get("/users/:userId", validate({ params: userIdParam }), reviewController.forUser);
v1.use("/reviews", reviews2);
var admin = Router();
admin.use(requireAdmin);
admin.get("/me", adminController.me);
admin.post("/password", validate({ body: changePasswordSchema }), adminController.changePassword);
admin.get("/stats", adminController.stats);
admin.get("/users", validate({ query: adminUsersQuerySchema }), adminController.users);
admin.patch("/users/:id", validate({ params: uuidParam, body: adminUpdateUserSchema }), adminController.updateUser);
admin.get("/listings", validate({ query: adminListingsQuerySchema }), adminController.listings);
admin.patch("/listings/:id", validate({ params: uuidParam, body: adminListingStatusSchema }), adminController.setListingStatus);
admin.delete("/listings/:id", validate({ params: uuidParam }), adminController.deleteListing);
v1.use("/admin", admin);

// src/middleware/errorHandler.ts
import multer2 from "multer";
function notFound(req, _res, next) {
  next(new AppError(404, "NOT_FOUND", `Route not found: ${req.method} ${req.path}`));
}
var body = (code, message, details) => ({
  success: false,
  error: { code, message, ...details !== void 0 ? { details } : {} }
});
function errorHandler(err, req, res, _next) {
  if (err instanceof RateLimitError) {
    res.setHeader("Retry-After", String(err.retryAfter));
    return res.status(429).json(body(err.code, err.message, err.details));
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(body(err.code, err.message, err.details));
  }
  if (err instanceof multer2.MulterError) {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    const message = tooBig ? "Each image must be 5MB or smaller" : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE" ? "At most 5 images per upload (field name: images)" : err.message;
    return res.status(tooBig ? 413 : 400).json(body(tooBig ? "FILE_TOO_LARGE" : "BAD_UPLOAD", message));
  }
  const e = err;
  if (e?.type === "entity.too.large") return res.status(413).json(body("PAYLOAD_TOO_LARGE", "Request body is too large (10KB max)"));
  if (e?.type === "entity.parse.failed") return res.status(400).json(body("INVALID_JSON", "Request body is not valid JSON"));
  logger.error("Unhandled error", { path: req.path, method: req.method, error: err instanceof Error ? err.stack : err });
  return res.status(500).json(body("INTERNAL_ERROR", config.isProd ? "Something went wrong" : err instanceof Error ? err.message : "Error"));
}

// src/app.ts
function createApp() {
  const app = express();
  if (config.isProd) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      // Listing images are loaded by the web app from another origin
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  if (!config.isTest) {
    app.use(morgan("tiny", { stream: { write: (line) => logger.http(line.trim()) } }));
  }
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());
  app.use("/uploads", express.static(path3.resolve(config.uploadDir), { maxAge: "7d", index: false }));
  app.use("/v1", v1);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// serverless/handler.ts
var ready;
function boot() {
  return (async () => {
    await runMigrations();
    await adminService.ensureAdmin();
    return createApp();
  })();
}
async function handler(req, res) {
  try {
    ready ??= boot();
    const app = await ready;
    app(req, res);
  } catch (err) {
    ready = void 0;
    console.error("API failed to start:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ success: false, error: { code: "STARTUP_FAILED", message: "The API could not start." } }));
  }
}
export {
  handler as default
};
