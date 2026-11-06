import { z } from 'zod';
import { listingStatusEnum, userRoleEnum } from '../db/schema.js';

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username').max(50),
  password: z.string().min(1, 'Enter your password').max(200),
});

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  role: z.enum(userRoleEnum.enumValues).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminUpdateUserSchema = z
  .object({
    isActive: z.boolean().optional(),
    role: z.enum(userRoleEnum.enumValues).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Send isActive or role' });

export const adminListingsQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  status: z.enum(listingStatusEnum.enumValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminListingStatusSchema = z.object({ status: z.enum(listingStatusEnum.enumValues) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(12, 'Use at least 12 characters')
    .max(100)
    .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), 'Use upper and lower case letters and a number'),
});
