import { z } from 'zod';
import { latitude, longitude } from './common.js';

export const sendOtpSchema = z.object({
  phone: z.string().trim().min(7, 'Enter a phone number').max(20),
});

export const verifyOtpSchema = z.object({
  phone: z.string().trim().min(7).max(20),
  code: z.string().regex(/^\d{6}$/, 'The code is 6 digits'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is too short').max(100).optional(),
    // ADMIN cannot be self-assigned
    role: z.enum(['FARMER', 'BUYER']).optional(),
    location: z.string().trim().min(2).max(100).optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Send at least one field to update' })
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    message: 'latitude and longitude must be sent together',
    path: ['latitude'],
  });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
