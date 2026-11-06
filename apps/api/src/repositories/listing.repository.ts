import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  produceListings,
  users,
  listingImages,
  type NewProduceListing,
  type ProduceListing,
  type ListingImage,
} from '../db/schema.js';

export interface ListingFilters {
  produce?: string;
  category?: ProduceListing['category'];
  location?: string;
  minQuantity?: number;
  maxPrice?: number;
  organic?: boolean;
  status?: ProduceListing['status'];
  sort?: 'newest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}

/** Numeric columns come back from Postgres as strings; the API exposes real numbers */
export function toListingDto(listing: ProduceListing) {
  return {
    id: listing.id,
    farmerId: listing.farmerId,
    produceType: listing.produceType,
    category: listing.category,
    quantity: Number(listing.quantity),
    unit: listing.unit,
    pricePerUnit: Number(listing.pricePerUnit),
    currency: listing.currency,
    location: listing.location,
    latitude: Number(listing.latitude),
    longitude: Number(listing.longitude),
    availableFrom: listing.availableFrom,
    availableTo: listing.availableTo,
    isOrganic: listing.isOrganic,
    description: listing.description,
    status: listing.status,
    viewCount: listing.viewCount,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}

export type ListingDto = ReturnType<typeof toListingDto>;

/** Escape LIKE wildcards in user input */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

class ListingRepository {
  async create(data: NewProduceListing) {
    const [listing] = await db.insert(produceListings).values(data).returning();
    return listing;
  }

  async findById(id: string) {
    const [row] = await db
      .select({
        listing: produceListings,
        farmer: { id: users.id, name: users.name, phone: users.phone, avatarUrl: users.avatarUrl },
      })
      .from(produceListings)
      .innerJoin(users, eq(produceListings.farmerId, users.id))
      .where(eq(produceListings.id, id))
      .limit(1);

    if (!row) return null;

    const images = await this.imagesFor(id);
    return { ...row, images };
  }

  /** Raw row, no joins (ownership checks) */
  async findRaw(id: string) {
    const [listing] = await db.select().from(produceListings).where(eq(produceListings.id, id)).limit(1);
    return listing ?? null;
  }

  async findAll(filters: ListingFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(produceListings.status, filters.status ?? 'ACTIVE')];
    if (filters.produce) {
      conditions.push(sql`${produceListings.produceType} ILIKE ${'%' + likeEscape(filters.produce) + '%'}`);
    }
    if (filters.category) conditions.push(eq(produceListings.category, filters.category));
    if (filters.location) conditions.push(sql`lower(${produceListings.location}) = ${filters.location.toLowerCase()}`);
    if (filters.minQuantity !== undefined) conditions.push(gte(produceListings.quantity, String(filters.minQuantity)));
    if (filters.maxPrice !== undefined) conditions.push(lte(produceListings.pricePerUnit, String(filters.maxPrice)));
    if (filters.organic) conditions.push(eq(produceListings.isOrganic, true));

    const where = and(...conditions);
    // id breaks ties so pages never repeat or skip rows
    const order =
      filters.sort === 'price_asc'
        ? [asc(produceListings.pricePerUnit), desc(produceListings.createdAt), asc(produceListings.id)]
        : filters.sort === 'price_desc'
          ? [desc(produceListings.pricePerUnit), desc(produceListings.createdAt), asc(produceListings.id)]
          : [desc(produceListings.createdAt), asc(produceListings.id)];

    const [rows, totalRows] = await Promise.all([
      db
        .select({ listing: produceListings, farmer: { id: users.id, name: users.name } })
        .from(produceListings)
        .innerJoin(users, eq(produceListings.farmerId, users.id))
        .where(where)
        .orderBy(...order)
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(produceListings).where(where),
    ]);

    const total = totalRows[0].count;
    const primary = await this.primaryImages(rows.map((r) => r.listing.id));

    return {
      items: rows.map((r) => ({
        ...toListingDto(r.listing),
        farmer: r.farmer,
        imageUrl: primary.get(r.listing.id) ?? null,
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByFarmer(farmerId: string) {
    const rows = await db
      .select()
      .from(produceListings)
      .where(eq(produceListings.farmerId, farmerId))
      .orderBy(desc(produceListings.createdAt));

    const images = rows.length
      ? await db
          .select()
          .from(listingImages)
          .where(inArray(listingImages.listingId, rows.map((r) => r.id)))
          .orderBy(asc(listingImages.sortOrder))
      : [];

    return rows.map((r) => ({ ...toListingDto(r), images: images.filter((i) => i.listingId === r.id) }));
  }

  async update(id: string, data: Partial<NewProduceListing>) {
    const [updated] = await db
      .update(produceListings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(produceListings.id, id))
      .returning();
    return updated ?? null;
  }

  async delete(id: string) {
    await db.delete(produceListings).where(eq(produceListings.id, id));
  }

  async incrementViewCount(id: string) {
    await db
      .update(produceListings)
      .set({ viewCount: sql`${produceListings.viewCount} + 1` })
      .where(eq(produceListings.id, id));
  }

  // ─── Images ────────────────────────────

  async imagesFor(listingId: string): Promise<ListingImage[]> {
    return db
      .select()
      .from(listingImages)
      .where(eq(listingImages.listingId, listingId))
      .orderBy(asc(listingImages.sortOrder));
  }

  private async primaryImages(listingIds: string[]) {
    const map = new Map<string, string>();
    if (!listingIds.length) return map;
    const rows = await db
      .select()
      .from(listingImages)
      .where(and(inArray(listingImages.listingId, listingIds), eq(listingImages.isPrimary, true)));
    for (const row of rows) map.set(row.listingId, row.url);
    return map;
  }

  async addImages(listingId: string, items: { url: string; isPrimary: boolean; sortOrder: number }[]) {
    if (!items.length) return [];
    return db.insert(listingImages).values(items.map((i) => ({ ...i, listingId }))).returning();
  }

  async findImage(listingId: string, imageId: string) {
    const [img] = await db
      .select()
      .from(listingImages)
      .where(and(eq(listingImages.id, imageId), eq(listingImages.listingId, listingId)))
      .limit(1);
    return img ?? null;
  }

  async deleteImage(imageId: string) {
    await db.delete(listingImages).where(eq(listingImages.id, imageId));
  }

  async setPrimaryImage(listingId: string, imageId: string) {
    await db.update(listingImages).set({ isPrimary: false }).where(eq(listingImages.listingId, listingId));
    await db.update(listingImages).set({ isPrimary: true }).where(eq(listingImages.id, imageId));
  }
}

export const listingRepository = new ListingRepository();
