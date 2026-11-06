import type { NextFunction, Request, Response } from 'express';
import { kv } from '../config/redis.js';
import { RateLimitError } from '../utils/errors.js';

interface Options {
  /** namespace so different limiters do not share counters */
  name: string;
  max: number;
  windowSeconds: number;
}

/**
 * Fixed-window limiter backed by the key-value store (Upstash Redis when configured).
 * Counted per signed-in user, else per IP.
 */
export function rateLimit({ name, max, windowSeconds }: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const who = req.user?.sub ?? req.ip ?? 'unknown';
    const key = `rl:${name}:${who}`;

    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, windowSeconds);

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - count)));

    if (count > max) {
      const retryAfter = Math.max(1, await kv.ttl(key));
      res.setHeader('Retry-After', String(retryAfter));
      throw new RateLimitError(retryAfter, 'RATE_LIMITED', 'Too many requests. Slow down and try again shortly.');
    }
    next();
  };
}
