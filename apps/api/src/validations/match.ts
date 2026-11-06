import { z } from 'zod';
import { isoDate, latitude, longitude } from './common.js';

const weight = z.number().min(0).max(1000);

export const matchSchema = z
  .object({
    produce: z.string().trim().max(100).optional(),
    quantity: z.number().positive().optional(),
    maxPrice: z.number().positive().optional(),
    location: z.string().trim().max(100).optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    requiredBy: isoDate.optional(),
    organicOnly: z.boolean().default(false),
    weights: z
      .object({
        produce: weight.optional(),
        quantity: weight.optional(),
        location: weight.optional(),
        price: weight.optional(),
        availability: weight.optional(),
      })
      .strict()
      .optional(),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    message: 'latitude and longitude must be sent together',
    path: ['latitude'],
  });

export type MatchInput = z.infer<typeof matchSchema>;
