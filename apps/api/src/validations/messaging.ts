import { z } from 'zod';

const content = z.string().trim().min(1, 'Message cannot be empty').max(2000);

export const startConversationSchema = z.object({
  listingId: z.string().uuid('Invalid listing id'),
  message: content.optional(),
});

export const sendMessageSchema = z.object({ content });

export const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** ISO timestamp: only messages older than this (for paging back) */
  before: z.string().datetime({ offset: true }).optional(),
});

export const priceHistoryQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export const createReviewSchema = z.object({
  listingId: z.string().uuid('Invalid listing id'),
  /** Required when the reviewer is the listing's farmer */
  buyerId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const userIdParam = z.object({ userId: z.string().uuid('Invalid user id') });
export const produceParam = z.object({ produce: z.string().trim().min(1).max(100) });
