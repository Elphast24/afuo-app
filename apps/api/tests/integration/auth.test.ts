import { beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, login, setup } from './helpers.js';
import { kv } from '../../src/config/redis.js';
import { smsService } from '../../src/services/sms.service.js';

beforeAll(setup);

describe('health + protection', () => {
  it('GET /v1/health is public', async () => {
    const res = await api().get('/v1/health').expect(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBe('pglite');
  });

  it('everything else needs a token', async () => {
    for (const path of ['/v1/listings', '/v1/analytics/summary', '/v1/conversations', '/v1/auth/me']) {
      const res = await api().get(path).expect(401);
      expect(res.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
    }
    await api().post('/v1/match').send({}).expect(401);
  });

  it('rejects a garbage token', async () => {
    const res = await api().get('/v1/auth/me').set('Authorization', 'Bearer nope').expect(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('unknown routes are JSON 404s', async () => {
    const res = await api().get('/v1/nothing-here').expect(401); // behind the auth wall
    expect(res.body.success).toBe(false);
    const open = await api().get('/nope').expect(404);
    expect(open.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /auth/otp/send', () => {
  it('validates the phone number (Ghana only)', async () => {
    const bad = await api().post('/v1/auth/otp/send').send({ phone: '0712345678' }).expect(400);
    expect(bad.body.error.message).toMatch(/Ghana/);
    await api().post('/v1/auth/otp/send').send({}).expect(422);
  });

  it('sends a code and enforces the 60s cooldown', async () => {
    const phone = '0201110001';
    const ok = await api().post('/v1/auth/otp/send').send({ phone }).expect(200);
    expect(ok.body).toMatchObject({
      success: true,
      data: { phone: '+233201110001', expiresIn: 300, retryAfter: 60 },
    });
    expect(smsService.lastOtpFor('+233201110001')).toMatch(/^\d{6}$/);
    // Fallback while no SMS provider exists: the code is also returned so the web app can show it on screen
    expect(ok.body.data.devCode).toBe(smsService.lastOtpFor('+233201110001'));

    const again = await api().post('/v1/auth/otp/send').send({ phone }).expect(429);
    expect(again.body.error.code).toBe('OTP_RATE_LIMITED');
    expect(Number(again.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('allows at most 5 codes per hour', async () => {
    const phone = '0201110002';
    for (let i = 0; i < 5; i++) {
      await kv.del('otp:cooldown:+233201110002');
      await api().post('/v1/auth/otp/send').send({ phone }).expect(200);
    }
    await kv.del('otp:cooldown:+233201110002');
    const sixth = await api().post('/v1/auth/otp/send').send({ phone }).expect(429);
    expect(sixth.body.error.code).toBe('OTP_RATE_LIMITED');
  });
});

describe('POST /auth/otp/verify', () => {
  it('wrong code, then the right one; sets httpOnly cookies; new then returning user', async () => {
    const phone = '0201110003';
    await api().post('/v1/auth/otp/send').send({ phone }).expect(200);
    const code = smsService.lastOtpFor('+233201110003')!;

    const wrong = await api()
      .post('/v1/auth/otp/verify')
      .send({ phone, code: code === '000000' ? '111111' : '000000' })
      .expect(401);
    expect(wrong.body.error).toMatchObject({ code: 'OTP_INVALID', message: 'Incorrect code. 4 attempts left.' });

    const ok = await api().post('/v1/auth/otp/verify').send({ phone, code }).expect(200);
    expect(ok.body.data.user).toMatchObject({ phone: '+233201110003', role: 'FARMER', isNewUser: true });
    expect(ok.body.data.tokens.expiresIn).toBe(900);

    const cookies = (ok.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(cookies).toMatch(/accessToken=.*HttpOnly.*SameSite=Lax/s);
    expect(cookies).toMatch(/refreshToken=.*Path=\/v1\/auth.*HttpOnly.*SameSite=Strict/s);

    // The code is single-use
    const reuse = await api().post('/v1/auth/otp/verify').send({ phone, code }).expect(401);
    expect(reuse.body.error.code).toBe('OTP_EXPIRED');

    // Signing in again is a returning user
    await kv.del('otp:cooldown:+233201110003');
    await api().post('/v1/auth/otp/send').send({ phone }).expect(200);
    const again = await api()
      .post('/v1/auth/otp/verify')
      .send({ phone, code: smsService.lastOtpFor('+233201110003') })
      .expect(200);
    expect(again.body.data.user.isNewUser).toBe(false);
    expect(again.body.data.user.id).toBe(ok.body.data.user.id);
  });

  it('rejects a code that is not 6 digits', async () => {
    await api().post('/v1/auth/otp/verify').send({ phone: '0201110003', code: '12ab' }).expect(422);
  });

  it('locks the number after 5 wrong codes, even for the right code', async () => {
    const phone = '0201110004';
    await api().post('/v1/auth/otp/send').send({ phone }).expect(200);
    const good = smsService.lastOtpFor('+233201110004')!;
    const bad = good === '123456' ? '654321' : '123456';

    for (let i = 0; i < 4; i++) {
      const r = await api().post('/v1/auth/otp/verify').send({ phone, code: bad }).expect(401);
      expect(r.body.error.code).toBe('OTP_INVALID');
    }
    const fifth = await api().post('/v1/auth/otp/verify').send({ phone, code: bad }).expect(401);
    expect(fifth.body.error.code).toBe('OTP_LOCKED');

    const withRight = await api().post('/v1/auth/otp/verify').send({ phone, code: good }).expect(401);
    expect(withRight.body.error.code).toBe('OTP_LOCKED');

    await kv.del('otp:cooldown:+233201110004');
    const send = await api().post('/v1/auth/otp/send').send({ phone }).expect(429);
    expect(send.body.error.code).toBe('OTP_LOCKED');
  });

  it('reports an expired / missing code', async () => {
    const res = await api().post('/v1/auth/otp/verify').send({ phone: '0201110005', code: '123456' }).expect(401);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });
});

describe('tokens, /auth/me, logout', () => {
  it('rotates refresh tokens and revokes the family when one is replayed', async () => {
    const s = await login('0201110010', 'FARMER');

    const r1 = await api().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(200);
    const next = r1.body.data.tokens.refreshToken;
    expect(next).not.toBe(s.refreshToken);

    // Replaying the old token fails and burns the whole family
    const replay = await api().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
    expect(replay.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    await api().post('/v1/auth/refresh').send({ refreshToken: next }).expect(401);
  });

  it('refresh works from the cookie too, and needs some token', async () => {
    await api().post('/v1/auth/refresh').send({}).expect(401);
    const s = await login('0201110011', 'FARMER');
    await api()
      .post('/v1/auth/refresh')
      .set('Cookie', `refreshToken=${s.refreshToken}`)
      .send({})
      .expect(200);
  });

  it('GET/PATCH /auth/me', async () => {
    const s = await login('0201110012', 'FARMER', 'Kwame Mensah');
    const me = await api().get('/v1/auth/me').set(bearer(s)).expect(200);
    expect(me.body.data.user).toMatchObject({ phone: '+233201110012', name: 'Kwame Mensah', role: 'FARMER' });

    const upd = await api()
      .patch('/v1/auth/me')
      .set(bearer(s))
      .send({ role: 'BUYER', location: 'Kumasi', latitude: 6.6885, longitude: -1.6244 })
      .expect(200);
    expect(upd.body.data.user).toMatchObject({ role: 'BUYER', location: 'Kumasi', latitude: 6.6885 });

    // the role change applies to the very next request
    await api().post('/v1/listings').set(bearer(s)).send({}).expect(403);

    await api().patch('/v1/auth/me').set(bearer(s)).send({ role: 'ADMIN' }).expect(422);
    await api().patch('/v1/auth/me').set(bearer(s)).send({}).expect(422);
    await api().patch('/v1/auth/me').set(bearer(s)).send({ latitude: 5 }).expect(422);
  });

  it('logout revokes the refresh token and clears cookies', async () => {
    const s = await login('0201110013', 'FARMER');
    const res = await api().post('/v1/auth/logout').send({ refreshToken: s.refreshToken }).expect(200);
    expect((res.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(/accessToken=;/);
    await api().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
  });

  it('accepts the access token from the cookie', async () => {
    const s = await login('0201110014', 'FARMER');
    await api().get('/v1/auth/me').set('Cookie', `accessToken=${s.token}`).expect(200);
  });
});
