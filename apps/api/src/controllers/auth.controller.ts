import type { Request, Response } from 'express';
import { authService, type TokenPair } from '../services/auth.service.js';
import { userRepository, toProfile } from '../repositories/user.repository.js';
import { config } from '../config/index.js';
import { NotFoundError, UnauthorizedError } from '../utils/errors.js';
import type { UpdateMeInput } from '../validations/auth.js';

/*
  Cookie strategy (docs 8.3): httpOnly always; Secure in production.
  Access token: SameSite=Lax, 15 min, sent everywhere.
  Refresh token: SameSite=Strict, 7 days, only sent to /v1/auth (refresh + logout).
*/
const REFRESH_PATH = '/v1/auth';

export function setAuthCookies(res: Response, tokens: TokenPair) {
  const base = { httpOnly: true, secure: config.isProd } as const;
  res.cookie('accessToken', tokens.accessToken, {
    ...base,
    sameSite: 'lax',
    path: '/',
    maxAge: config.jwt.accessTtlSeconds * 1000,
  });
  res.cookie('refreshToken', tokens.refreshToken, {
    ...base,
    sameSite: 'strict',
    path: REFRESH_PATH,
    maxAge: config.jwt.refreshTtlSeconds * 1000,
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: REFRESH_PATH });
}

const readRefreshToken = (req: Request): string | undefined => req.cookies?.refreshToken ?? req.body?.refreshToken;

export const authController = {
  async sendOtp(req: Request, res: Response) {
    const data = await authService.sendOTP(req.body.phone);
    res.json({ success: true, message: 'OTP sent successfully', data });
  },

  async verifyOtp(req: Request, res: Response) {
    const { user, tokens } = await authService.verifyOTP(req.body.phone, req.body.code);
    setAuthCookies(res, tokens);
    res.json({ success: true, data: { user, tokens } });
  },

  async refresh(req: Request, res: Response) {
    const token = readRefreshToken(req);
    if (!token) throw new UnauthorizedError('Refresh token missing', 'INVALID_REFRESH_TOKEN');
    const tokens = await authService.refreshAccessToken(token);
    setAuthCookies(res, tokens);
    res.json({ success: true, data: { tokens } });
  },

  async logout(req: Request, res: Response) {
    await authService.logout(readRefreshToken(req));
    clearAuthCookies(res);
    res.json({ success: true, message: 'Signed out' });
  },

  async me(req: Request, res: Response) {
    const user = await userRepository.findById(req.user!.sub);
    if (!user) throw new NotFoundError('User not found');
    res.json({ success: true, data: { user: toProfile(user) } });
  },

  async updateMe(req: Request, res: Response) {
    const input = req.body as UpdateMeInput;
    const user = await userRepository.update(req.user!.sub, {
      name: input.name,
      role: input.role,
      location: input.location,
      latitude: input.latitude === undefined ? undefined : String(input.latitude),
      longitude: input.longitude === undefined ? undefined : String(input.longitude),
    });
    if (!user) throw new NotFoundError('User not found');
    res.json({ success: true, data: { user: toProfile(user) } });
  },
};
