import 'dotenv/config';
import { z } from 'zod';

const DEV_ACCESS_SECRET = 'dev-only-access-secret-change-me-please-0000';
const DEV_REFRESH_SECRET = 'dev-only-refresh-secret-change-me-please-000';
/** Development-only admin password. Never used in production. */
export const DEV_ADMIN_PASSWORD = 'AgriMatch@Admin2026';

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: optionalString,
  DATA_DIR: z.string().default('./.data'),

  UPSTASH_REDIS_REST_URL: optionalString,
  UPSTASH_REDIS_REST_TOKEN: optionalString,

  JWT_ACCESS_SECRET: optionalString,
  JWT_REFRESH_SECRET: optionalString,
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  ADMIN_USERNAME: z.string().trim().min(3).max(50).default('admin'),
  ADMIN_PASSWORD: optionalString,

  UPLOAD_DIR: z.string().default('./uploads'),
  /**
   * Fallback while no SMS provider is connected: return the one-time code in the send-OTP response so the web app can show it
   * on screen. 'auto' (default) does that only while there is no provider; 'false' never does; 'true' always does.
   * Anyone who can request a code for a number can then sign in as that number, so connect SMS and rely on 'auto'.
   */
  EXPOSE_OTP: z.enum(['auto', 'true', 'false']).default('auto'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const env = parsed.data;
const isProd = env.NODE_ENV === 'production';

if (isProd && (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET)) {
  console.error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required in production.');
  process.exit(1);
}

if (isProd && env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length < 12) {
  console.error('ADMIN_PASSWORD must be at least 12 characters in production.');
  process.exit(1);
}

/** Seconds for a "15m" / "7d" / "3600" style duration */
export function durationToSeconds(value: string): number {
  const m = /^(\d+)\s*([smhd]?)$/.exec(value.trim());
  if (!m) throw new Error(`Invalid duration: ${value}`);
  const n = Number(m[1]);
  const unit = m[2] || 's';
  return n * { s: 1, m: 60, h: 3600, d: 86400 }[unit as 's' | 'm' | 'h' | 'd'];
}

export const config = {
  env: env.NODE_ENV,
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  corsOrigins: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
  logLevel: env.LOG_LEVEL,
  database: {
    url: env.DATABASE_URL,
    dataDir: env.DATA_DIR,
  },
  redis: {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  },
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET ?? DEV_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET ?? DEV_REFRESH_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    accessTtlSeconds: durationToSeconds(env.JWT_ACCESS_EXPIRES_IN),
    refreshTtlSeconds: durationToSeconds(env.JWT_REFRESH_EXPIRES_IN),
  },
  admin: {
    username: env.ADMIN_USERNAME,
    /** In production the admin account is only created when ADMIN_PASSWORD is set */
    password: env.ADMIN_PASSWORD ?? (isProd ? undefined : DEV_ADMIN_PASSWORD),
    usingDevPassword: !env.ADMIN_PASSWORD && !isProd,
    lockSeconds: 900,
    maxFailures: 5,
  },
  uploadDir: env.UPLOAD_DIR,
  /** requests per minute, per user (or IP when signed out). Effectively off under test. */
  rateLimit: {
    windowSeconds: 60,
    general: env.NODE_ENV === 'test' ? 1_000_000 : 100,
    otp: env.NODE_ENV === 'test' ? 1_000_000 : 20,
  },
  otp: {
    ttlSeconds: 300,
    cooldownSeconds: 60,
    maxAttempts: 5,
    maxPerHour: 5,
    lockSeconds: 1800,
    exposeCode: env.EXPOSE_OTP,
  },
} as const;
