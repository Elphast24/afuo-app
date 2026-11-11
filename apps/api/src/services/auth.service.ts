import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, refreshTokens } from '../db/schema.js';
import { kv } from '../config/redis.js';
import { config } from '../config/index.js';
import { smsService } from './sms.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { RateLimitError, UnauthorizedError } from '../utils/errors.js';
import { normalizePhone } from '../utils/phone.js';
import { generateOtp, sha256 } from '../utils/crypto.js';

interface OtpData {
  hash: string;
  attempts: number;
  createdAt: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AccessPayload {
  sub: string;
  phone: string;
  role: 'FARMER' | 'BUYER' | 'ADMIN';
}

class AuthService {
  async sendOTP(rawPhone: string): Promise<{ phone: string; expiresIn: number; retryAfter: number; devCode?: string }> {
    const phone = normalizePhone(rawPhone);
    const { cooldownSeconds, ttlSeconds, maxPerHour } = config.otp;

    // Locked out after too many wrong codes
    const lockKey = `otp:lock:${phone}`;
    if (await kv.exists(lockKey)) {
      throw new RateLimitError(await kv.ttl(lockKey), 'OTP_LOCKED', 'Too many wrong attempts. Try again later.');
    }

    // 60s between sends
    const cooldownKey = `otp:cooldown:${phone}`;
    if (await kv.exists(cooldownKey)) {
      const wait = await kv.ttl(cooldownKey);
      throw new RateLimitError(wait, 'OTP_RATE_LIMITED', `Please wait ${wait} seconds before requesting another OTP`);
    }

    // Max 5 per hour
    const hourlyKey = `otp:hourly:${phone}`;
    const count = await kv.incr(hourlyKey);
    if (count === 1) await kv.expire(hourlyKey, 3600);
    if (count > maxPerHour) {
      const wait = Math.max(1, await kv.ttl(hourlyKey));
      throw new RateLimitError(wait, 'OTP_RATE_LIMITED', 'Too many codes requested. Try again later.');
    }

    const code = generateOtp();
    const data: OtpData = { hash: await bcrypt.hash(code, 10), attempts: 0, createdAt: Date.now() };
    await kv.set(`otp:${phone}`, JSON.stringify(data), { ex: ttlSeconds });
    await kv.set(cooldownKey, '1', { ex: cooldownSeconds });

    await smsService.sendOTP(phone, code);
    // Fallback while no SMS provider is connected: hand the code back so the web app can show it on screen (see EXPOSE_OTP)
    const expose = config.otp.exposeCode === 'true' || (config.otp.exposeCode === 'auto' && !smsService.hasProvider);
    return { phone, expiresIn: ttlSeconds, retryAfter: cooldownSeconds, ...(expose ? { devCode: code } : {}) };
  }

  async verifyOTP(rawPhone: string, code: string) {
    const phone = normalizePhone(rawPhone);
    const { maxAttempts, lockSeconds } = config.otp;

    const lockKey = `otp:lock:${phone}`;
    if (await kv.exists(lockKey)) {
      throw new UnauthorizedError('Too many wrong attempts. Try again later.', 'OTP_LOCKED');
    }

    const otpKey = `otp:${phone}`;
    const stored = await kv.get(otpKey);
    if (!stored) {
      throw new UnauthorizedError('Code expired or not found. Please request a new one.', 'OTP_EXPIRED');
    }

    const otp: OtpData = JSON.parse(stored);
    const valid = await bcrypt.compare(code, otp.hash);

    if (!valid) {
      otp.attempts += 1;
      if (otp.attempts >= maxAttempts) {
        await kv.del(otpKey);
        await kv.set(lockKey, '1', { ex: lockSeconds });
        throw new UnauthorizedError('Too many wrong attempts. Locked for 30 minutes.', 'OTP_LOCKED');
      }
      await kv.set(otpKey, JSON.stringify(otp), { keepTtl: true });
      const remaining = maxAttempts - otp.attempts;
      throw new UnauthorizedError(
        `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
        'OTP_INVALID'
      );
    }

    await kv.del(otpKey);

    // Find or create the user
    let user = await userRepository.findByPhone(phone);
    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await userRepository.create({ phone, phoneVerified: true, lastLoginAt: new Date() });
    } else {
      if (!user.isActive) throw new UnauthorizedError('This account is deactivated', 'ACCOUNT_DISABLED');
      user = (await userRepository.update(user.id, { phoneVerified: true, lastLoginAt: new Date() }))!;
    }

    const tokens = await this.issueTokens(user);
    return {
      user: { id: user.id, phone: user.phone, name: user.name, role: user.role, isNewUser },
      tokens,
    };
  }

  /** Single-use refresh: the presented token is revoked and a new pair issued */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const hashed = sha256(refreshToken);
    const [stored] = await db.select().from(refreshTokens).where(eq(refreshTokens.token, hashed)).limit(1);

    if (!stored) {
      // A validly signed token that is no longer stored was already used or revoked: treat as theft, revoke the family
      if (payload.sub) await db.delete(refreshTokens).where(eq(refreshTokens.userId, payload.sub));
      throw new UnauthorizedError('Refresh token expired or revoked', 'INVALID_REFRESH_TOKEN');
    }
    if (stored.expiresAt < new Date()) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
      throw new UnauthorizedError('Refresh token expired or revoked', 'INVALID_REFRESH_TOKEN');
    }

    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

    const user = await userRepository.findById(stored.userId);
    if (!user || !user.isActive) throw new UnauthorizedError('User not found', 'INVALID_REFRESH_TOKEN');

    return this.issueTokens(user);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await db.delete(refreshTokens).where(eq(refreshTokens.token, sha256(refreshToken)));
  }

  verifyAccessToken(token: string): AccessPayload {
    try {
      const p = jwt.verify(token, config.jwt.accessSecret) as jwt.JwtPayload;
      return { sub: String(p.sub), phone: String(p.phone), role: p.role };
    } catch {
      throw new UnauthorizedError('Invalid or expired access token', 'INVALID_TOKEN');
    }
  }

  async issueTokens(user: typeof users.$inferSelect): Promise<TokenPair> {
    const accessToken = jwt.sign({ sub: user.id, phone: user.phone, role: user.role }, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessTtlSeconds,
    });
    const refreshToken = jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshTtlSeconds,
    });

    await db.insert(refreshTokens).values({
      userId: user.id,
      token: sha256(refreshToken),
      expiresAt: new Date(Date.now() + config.jwt.refreshTtlSeconds * 1000),
    });

    return { accessToken, refreshToken, expiresIn: config.jwt.accessTtlSeconds };
  }
}

export const authService = new AuthService();
