/*
  Key-value store used for OTPs, send cooldowns, lockouts and rate limiting.

  The docs call for Upstash Redis. That needs an account, so by default this uses an in-process store with the
  same semantics (TTL, INCR, EXPIRE). Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to use Upstash instead.
  The in-process store is per-instance: fine for development and a single server, not for several instances.
*/
import { config } from './index.js';
import { logger } from './logger.js';

export interface SetOptions {
  /** expiry in seconds */
  ex?: number;
  /** keep the existing TTL when overwriting */
  keepTtl?: boolean;
}

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: SetOptions): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** remaining seconds, or -2 if the key does not exist, -1 if it has no expiry */
  ttl(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  /** testing aid */
  flushAll(): Promise<void>;
}

class MemoryStore implements KeyValueStore {
  private data = new Map<string, { value: string; expiresAt: number | null }>();

  private live(key: string) {
    const entry = this.data.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }

  async get(key: string) {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, options: SetOptions = {}) {
    const existing = this.live(key);
    const expiresAt = options.keepTtl && existing ? existing.expiresAt : options.ex ? Date.now() + options.ex * 1000 : null;
    this.data.set(key, { value, expiresAt });
  }

  async del(key: string) {
    this.data.delete(key);
  }

  async exists(key: string) {
    return this.live(key) !== undefined;
  }

  async ttl(key: string) {
    const entry = this.live(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  async incr(key: string) {
    const entry = this.live(key);
    const next = (entry ? Number(entry.value) : 0) + 1;
    this.data.set(key, { value: String(next), expiresAt: entry ? entry.expiresAt : null });
    return next;
  }

  async expire(key: string, seconds: number) {
    const entry = this.live(key);
    if (entry) entry.expiresAt = Date.now() + seconds * 1000;
  }

  async flushAll() {
    this.data.clear();
  }
}

async function createUpstashStore(url: string, token: string): Promise<KeyValueStore> {
  const { Redis } = await import('@upstash/redis');
  // Values are plain strings: stop the client from JSON-parsing them
  const redis = new Redis({ url, token, automaticDeserialization: false });
  return {
    async get(key) {
      return (await redis.get<string | null>(key)) ?? null;
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
      return (await redis.exists(key)) > 0;
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
    },
  };
}

async function createStore(): Promise<KeyValueStore> {
  if (config.redis.url && config.redis.token) {
    logger.info('Key-value store: Upstash Redis');
    return createUpstashStore(config.redis.url, config.redis.token);
  }
  logger.info('Key-value store: in-process memory (set UPSTASH_REDIS_REST_URL/TOKEN to use Upstash)');
  return new MemoryStore();
}

export const kv: KeyValueStore = await createStore();
