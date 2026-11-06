import { z } from 'zod';

export const uuidParam = z.object({ id: z.string().uuid('Invalid id') });

/** YYYY-MM-DD that is a real calendar date */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Not a valid date');

/** "true"/"false"/"1"/"0" from a query string */
export const queryBool = z.preprocess((v) => {
  if (typeof v === 'string') {
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  }
  return v;
}, z.boolean());

export const latitude = z.number().min(-90).max(90);
export const longitude = z.number().min(-180).max(180);
