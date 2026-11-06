import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../db/index.js';
import { conversations, messages, produceListings, users } from '../db/schema.js';

class ConversationRepository {
  async findByBuyerAndListing(buyerId: string, listingId: string) {
    const [row] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.buyerId, buyerId), eq(conversations.listingId, listingId)))
      .limit(1);
    return row ?? null;
  }

  async create(buyerId: string, listingId: string) {
    const [row] = await db.insert(conversations).values({ buyerId, listingId }).returning();
    return row;
  }

  /** Conversation plus the listing's farmer, for participant checks */
  async findWithParties(id: string) {
    const [row] = await db
      .select({
        id: conversations.id,
        buyerId: conversations.buyerId,
        listingId: conversations.listingId,
        farmerId: produceListings.farmerId,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .innerJoin(produceListings, eq(conversations.listingId, produceListings.id))
      .where(eq(conversations.id, id))
      .limit(1);
    return row ?? null;
  }

  /** All conversations a user is in (as buyer, or as the farmer who owns the listing) */
  async listForUser(userId: string) {
    const buyer = alias(users, 'buyer');
    const farmer = alias(users, 'farmer');

    const rows = await db
      .select({
        id: conversations.id,
        createdAt: conversations.createdAt,
        listing: {
          id: produceListings.id,
          produceType: produceListings.produceType,
          pricePerUnit: produceListings.pricePerUnit,
          currency: produceListings.currency,
          location: produceListings.location,
        },
        buyer: { id: buyer.id, name: buyer.name },
        farmer: { id: farmer.id, name: farmer.name },
      })
      .from(conversations)
      .innerJoin(produceListings, eq(conversations.listingId, produceListings.id))
      .innerJoin(buyer, eq(conversations.buyerId, buyer.id))
      .innerJoin(farmer, eq(produceListings.farmerId, farmer.id))
      .where(or(eq(conversations.buyerId, userId), eq(produceListings.farmerId, userId)));

    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);

    const [lastRows, unreadRows] = await Promise.all([
      db.execute(sql`
        select distinct on (conversation_id) id, conversation_id as "conversationId", sender_id as "senderId",
               content, created_at as "createdAt"
        from messages
        where conversation_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})
        order by conversation_id, created_at desc
      `),
      db
        .select({ conversationId: messages.conversationId, unread: sql<number>`count(*)::int` })
        .from(messages)
        .where(and(inArray(messages.conversationId, ids), ne(messages.senderId, userId), isNull(messages.readAt)))
        .groupBy(messages.conversationId),
    ]);

    type Last = { id: string; conversationId: string; senderId: string; content: string; createdAt: Date | string };
    const lastBy = new Map<string, Last>();
    for (const m of (lastRows as unknown as { rows: Last[] }).rows) lastBy.set(m.conversationId, m);
    const unreadBy = new Map(unreadRows.map((u) => [u.conversationId, u.unread]));

    return rows
      .map((r) => {
        const last = lastBy.get(r.id) ?? null;
        return {
          id: r.id,
          createdAt: r.createdAt,
          listing: { ...r.listing, pricePerUnit: Number(r.listing.pricePerUnit) },
          buyer: r.buyer,
          farmer: r.farmer,
          lastMessage: last
            ? { id: last.id, senderId: last.senderId, content: last.content, createdAt: new Date(last.createdAt) }
            : null,
          unreadCount: unreadBy.get(r.id) ?? 0,
        };
      })
      .sort(
        (a, b) =>
          (b.lastMessage?.createdAt ?? b.createdAt).getTime() - (a.lastMessage?.createdAt ?? a.createdAt).getTime()
      );
  }

  /** Newest `limit` messages (optionally older than `before`), returned oldest first */
  async listMessages(conversationId: string, limit: number, before?: Date) {
    const conditions = [eq(messages.conversationId, conversationId)];
    if (before) conditions.push(lt(messages.createdAt, before));

    const rows = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit);
    return rows.reverse();
  }

  async createMessage(conversationId: string, senderId: string, content: string) {
    const [row] = await db.insert(messages).values({ conversationId, senderId, content }).returning();
    return row;
  }

  /** Marks everything the other person sent as read; returns how many changed */
  async markRead(conversationId: string, readerId: string) {
    const updated = await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(eq(messages.conversationId, conversationId), ne(messages.senderId, readerId), isNull(messages.readAt)))
      .returning({ id: messages.id });
    return updated.length;
  }
}

export const conversationRepository = new ConversationRepository();
