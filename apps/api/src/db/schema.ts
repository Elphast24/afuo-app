import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  pgEnum,
  numeric,
  date,
  text,
  integer,
  smallint,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['FARMER', 'BUYER', 'ADMIN']);

export const produceCategoryEnum = pgEnum('produce_category', [
  'VEGETABLES',
  'FRUITS',
  'GRAINS',
  'LEGUMES',
  'DAIRY',
  'LIVESTOCK',
  'OTHER',
]);

export const unitTypeEnum = pgEnum('unit_type', [
  'KG',
  'TONS',
  'CRATES',
  'BAGS_90KG',
  'PIECES',
  'LITRES',
  'BUNCHES',
]);

export const listingStatusEnum = pgEnum('listing_status', ['ACTIVE', 'SOLD', 'EXPIRED', 'DEACTIVATED']);

// ─── Users ───────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: varchar('phone', { length: 20 }).notNull().unique(),
    /** Admin accounts sign in with username + password instead of a phone OTP */
    username: varchar('username', { length: 50 }).unique(),
    passwordHash: varchar('password_hash', { length: 100 }),
    phoneVerified: boolean('phone_verified').notNull().default(false),
    name: varchar('name', { length: 100 }),
    role: userRoleEnum('role').notNull().default('FARMER'),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    location: varchar('location', { length: 100 }),
    latitude: numeric('latitude', { precision: 10, scale: 8 }),
    longitude: numeric('longitude', { precision: 11, scale: 8 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (table) => [index('users_role_idx').on(table.role)]
);

// ─── Produce Listings ────────────────────

export const produceListings = pgTable(
  'produce_listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    farmerId: uuid('farmer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    produceType: varchar('produce_type', { length: 100 }).notNull(),
    category: produceCategoryEnum('category').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(),
    unit: unitTypeEnum('unit').notNull(),
    pricePerUnit: numeric('price_per_unit', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('GHS'),
    location: varchar('location', { length: 100 }).notNull(),
    latitude: numeric('latitude', { precision: 10, scale: 8 }).notNull(),
    longitude: numeric('longitude', { precision: 11, scale: 8 }).notNull(),
    availableFrom: date('available_from').notNull(),
    availableTo: date('available_to').notNull(),
    isOrganic: boolean('is_organic').notNull().default(false),
    description: text('description'),
    status: listingStatusEnum('status').notNull().default('ACTIVE'),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('listings_produce_type_idx').on(table.produceType),
    index('listings_category_idx').on(table.category),
    index('listings_location_idx').on(table.location),
    index('listings_status_idx').on(table.status),
    index('listings_farmer_idx').on(table.farmerId),
    index('listings_availability_idx').on(table.availableFrom, table.availableTo),
    index('listings_geo_idx').on(table.latitude, table.longitude),
  ]
);

// ─── Listing Images ──────────────────────

export const listingImages = pgTable('listing_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => produceListings.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 500 }).notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ─── Conversations ───────────────────────

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    buyerId: uuid('buyer_id')
      .notNull()
      .references(() => users.id),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => produceListings.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('conversations_buyer_listing_idx').on(table.buyerId, table.listingId)]
);

// ─── Messages ────────────────────────────

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('messages_conversation_idx').on(table.conversationId, table.createdAt)]
);

// ─── Reviews ─────────────────────────────

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id),
    revieweeId: uuid('reviewee_id')
      .notNull()
      .references(() => users.id),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => produceListings.id, { onDelete: 'cascade' }),
    rating: smallint('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('reviews_reviewer_listing_idx').on(table.reviewerId, table.listingId)]
);

// ─── Refresh Tokens ──────────────────────

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 hex of the refresh token (the raw token is never stored) */
    token: varchar('token', { length: 500 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('refresh_tokens_user_idx').on(table.userId)]
);

// ─── Relations ───────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  listings: many(produceListings),
  sentMessages: many(messages),
  buyerConversations: many(conversations),
  reviewsGiven: many(reviews, { relationName: 'reviewer' }),
  reviewsReceived: many(reviews, { relationName: 'reviewee' }),
  refreshTokens: many(refreshTokens),
}));

export const produceListingsRelations = relations(produceListings, ({ one, many }) => ({
  farmer: one(users, { fields: [produceListings.farmerId], references: [users.id] }),
  images: many(listingImages),
  conversations: many(conversations),
  reviews: many(reviews),
}));

export const listingImagesRelations = relations(listingImages, ({ one }) => ({
  listing: one(produceListings, { fields: [listingImages.listingId], references: [produceListings.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  buyer: one(users, { fields: [conversations.buyerId], references: [users.id] }),
  listing: one(produceListings, { fields: [conversations.listingId], references: [produceListings.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  reviewer: one(users, { fields: [reviews.reviewerId], references: [users.id], relationName: 'reviewer' }),
  reviewee: one(users, { fields: [reviews.revieweeId], references: [users.id], relationName: 'reviewee' }),
  listing: one(produceListings, { fields: [reviews.listingId], references: [produceListings.id] }),
}));

// ─── Type Exports ────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ProduceListing = typeof produceListings.$inferSelect;
export type NewProduceListing = typeof produceListings.$inferInsert;
export type ListingImage = typeof listingImages.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
