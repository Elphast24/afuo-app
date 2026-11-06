import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { reviews, users } from '../db/schema.js';
import { conversationRepository } from '../repositories/conversation.repository.js';
import { listingRepository } from '../repositories/listing.repository.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';

class ReviewService {
  /**
   * Rate the other party of a deal. Only people who had a conversation about the listing can review,
   * a buyer reviews the farmer and a farmer reviews the buyer, once per listing.
   */
  async create(reviewerId: string, input: { listingId: string; buyerId?: string; rating: number; comment?: string }) {
    const listing = await listingRepository.findRaw(input.listingId);
    if (!listing) throw new NotFoundError('Listing not found');

    let revieweeId: string;
    if (listing.farmerId === reviewerId) {
      // Farmer reviewing a buyer: say which buyer
      if (!input.buyerId) throw new ForbiddenError('buyerId is required when a farmer leaves a review');
      const convo = await conversationRepository.findByBuyerAndListing(input.buyerId, listing.id);
      if (!convo) throw new ForbiddenError('That buyer has not contacted you about this listing');
      revieweeId = input.buyerId;
    } else {
      const convo = await conversationRepository.findByBuyerAndListing(reviewerId, listing.id);
      if (!convo) throw new ForbiddenError('You can only review a farmer you have contacted about this listing');
      revieweeId = listing.farmerId;
    }

    const [existing] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.reviewerId, reviewerId), eq(reviews.listingId, listing.id)))
      .limit(1);
    if (existing) throw new ConflictError('You have already reviewed this listing');

    const [created] = await db
      .insert(reviews)
      .values({ reviewerId, revieweeId, listingId: listing.id, rating: input.rating, comment: input.comment ?? null })
      .returning();
    return created;
  }

  async forUser(userId: string) {
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        listingId: reviews.listingId,
        createdAt: reviews.createdAt,
        reviewer: { id: users.id, name: users.name },
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.reviewerId, users.id))
      .where(eq(reviews.revieweeId, userId))
      .orderBy(desc(reviews.createdAt));

    const [agg] = await db
      .select({ avg: sql<number>`coalesce(round(avg(${reviews.rating}), 2), 0)::float`, count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(eq(reviews.revieweeId, userId));

    return { averageRating: agg.avg, count: agg.count, reviews: rows };
  }
}

export const reviewService = new ReviewService();
