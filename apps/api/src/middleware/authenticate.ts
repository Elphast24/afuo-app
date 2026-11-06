import type { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.accessToken;
}

/**
 * Verifies the access token (Authorization: Bearer, or the accessToken cookie) and loads the user.
 * The role and active flag come from the database, so a role change or deactivation applies immediately
 * instead of waiting for the 15-minute token to expire.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) throw new UnauthorizedError('Authentication required');

  const payload = authService.verifyAccessToken(token);
  const user = await userRepository.findById(payload.sub);
  if (!user || !user.isActive) throw new UnauthorizedError('Account not found or deactivated', 'INVALID_TOKEN');

  req.user = { sub: user.id, phone: user.phone, role: user.role };
  next();
}

/** Allow only the listed roles (ADMIN always passes) */
export function authorize(...roles: Array<'FARMER' | 'BUYER' | 'ADMIN'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role) throw new UnauthorizedError('Authentication required');
    if (role !== 'ADMIN' && !roles.includes(role)) {
      throw new ForbiddenError(`This action is for ${roles.map((r) => r.toLowerCase()).join(' / ')} accounts`);
    }
    next();
  };
}

/** Admin dashboard endpoints: ADMIN only (unlike authorize(), no other role passes) */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') throw new ForbiddenError('Administrators only');
  next();
}
