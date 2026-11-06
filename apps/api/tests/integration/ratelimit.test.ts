import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { rateLimit } from '../../src/middleware/rateLimit.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

describe('rateLimit middleware', () => {
  const app = express();
  app.get('/limited', rateLimit({ name: 'test-a', max: 3, windowSeconds: 60 }), (_req, res) => res.json({ ok: true }));
  app.get('/other', rateLimit({ name: 'test-b', max: 1, windowSeconds: 60 }), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  it('allows up to max requests, then answers 429 with Retry-After', async () => {
    for (let i = 1; i <= 3; i++) {
      const ok = await request(app).get('/limited').expect(200);
      expect(ok.headers['ratelimit-limit']).toBe('3');
      expect(ok.headers['ratelimit-remaining']).toBe(String(3 - i));
    }
    const blocked = await request(app).get('/limited').expect(429);
    expect(blocked.body).toMatchObject({ success: false, error: { code: 'RATE_LIMITED' } });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('keeps separate counters per limiter', async () => {
    await request(app).get('/other').expect(200);
    await request(app).get('/other').expect(429);
    // /limited is already exhausted, /other has its own budget
    await request(app).get('/limited').expect(429);
  });
});
