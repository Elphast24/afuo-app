import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../../src/app.js';
import { kv } from '../../src/config/redis.js';
import { smsService } from '../../src/services/sms.service.js';
import { runMigrations } from '../../src/db/index.js';
import { adminService } from '../../src/services/admin.service.js';

export const app = createApp();
export const api = () => request(app);

let migrated = false;
export async function setup() {
  if (!migrated) {
    await runMigrations();
    await adminService.ensureAdmin();
    migrated = true;
  }
}

export interface Session {
  phone: string;
  token: string;
  refreshToken: string;
  userId: string;
}

/** Full OTP login. `role` is applied with PATCH /auth/me. Phones must be unique per test user. */
export async function login(phone: string, role: 'FARMER' | 'BUYER', name = 'Test User'): Promise<Session> {
  await kv.del(`otp:cooldown:${phone}`);
  await api().post('/v1/auth/otp/send').send({ phone }).expect(200);
  const normalized = phone.startsWith('+') ? phone : `+233${phone.replace(/\D/g, '').replace(/^0/, '')}`;
  const code = smsService.lastOtpFor(normalized)!;

  const res = await api().post('/v1/auth/otp/verify').send({ phone, code }).expect(200);
  const { user, tokens } = res.body.data;

  await api()
    .patch('/v1/auth/me')
    .set('Authorization', `Bearer ${tokens.accessToken}`)
    .send({ role, name })
    .expect(200);

  return { phone: normalized, token: tokens.accessToken, refreshToken: tokens.refreshToken, userId: user.id };
}

export const bearer = (s: Session) => ({ Authorization: `Bearer ${s.token}` });

export const today = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

export const listingBody = (over: Record<string, unknown> = {}) => ({
  produceType: 'Tomatoes',
  quantity: 500,
  unit: 'KG',
  pricePerUnit: 22,
  location: 'Accra',
  availableFrom: today(-2),
  availableTo: today(40),
  isOrganic: false,
  description: 'Fresh tomatoes',
  ...over,
});

export const png = () =>
  sharp({ create: { width: 24, height: 24, channels: 3, background: '#2d6a4f' } })
    .png()
    .toBuffer();
