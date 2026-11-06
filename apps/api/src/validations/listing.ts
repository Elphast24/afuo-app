import { z } from 'zod';
import { produceCategoryEnum, unitTypeEnum, listingStatusEnum } from '../db/schema.js';
import { isoDate, latitude, longitude, queryBool } from './common.js';

const category = z.enum(produceCategoryEnum.enumValues);
const unit = z.enum(unitTypeEnum.enumValues);
const status = z.enum(listingStatusEnum.enumValues);

const baseFields = {
  produceType: z.string().trim().min(2).max(100),
  category: category.optional(),
  quantity: z.number().positive().max(9_999_999_999),
  unit,
  pricePerUnit: z.number().positive().max(99_999_999),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code')
    .default('GHS'),
  location: z.string().trim().min(2).max(100),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  availableFrom: isoDate,
  availableTo: isoDate,
  isOrganic: z.boolean().default(false),
  description: z.string().trim().max(2000).nullish().transform((v) => v ?? undefined),
};

const coordsTogether = (v: { latitude?: number; longitude?: number }) =>
  (v.latitude === undefined) === (v.longitude === undefined);

export const createListingSchema = z
  .object(baseFields)
  .refine(coordsTogether, { message: 'latitude and longitude must be sent together', path: ['latitude'] })
  .refine((v) => v.availableTo >= v.availableFrom, {
    message: 'availableTo must be on or after availableFrom',
    path: ['availableTo'],
  });

export const updateListingSchema = z
  .object({
    produceType: baseFields.produceType,
    category,
    quantity: baseFields.quantity,
    unit,
    pricePerUnit: baseFields.pricePerUnit,
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
    location: baseFields.location,
    latitude,
    longitude,
    availableFrom: isoDate,
    availableTo: isoDate,
    isOrganic: z.boolean(),
    description: z.string().trim().max(2000).nullable(),
    status,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Send at least one field to update' })
  .refine(coordsTogether, { message: 'latitude and longitude must be sent together', path: ['latitude'] })
  .refine((v) => !v.availableFrom || !v.availableTo || v.availableTo >= v.availableFrom, {
    message: 'availableTo must be on or after availableFrom',
    path: ['availableTo'],
  });

export const listingQuerySchema = z.object({
  produce: z.string().trim().min(1).max(100).optional(),
  category: category.optional(),
  location: z.string().trim().min(1).max(100).optional(),
  minQuantity: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  organic: queryBool.optional(),
  status: status.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listingImageParams = z.object({
  id: z.string().uuid('Invalid id'),
  imgId: z.string().uuid('Invalid image id'),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type ListingQuery = z.infer<typeof listingQuerySchema>;
