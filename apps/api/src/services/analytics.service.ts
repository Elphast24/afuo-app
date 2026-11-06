import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { produceListings, users } from '../db/schema.js';
import { toListingDto } from '../repositories/listing.repository.js';
import { buildBalance, buildInsights, buildMatrix, weekChangePct } from './insights.js';

/** Upper bounds (GHS per unit) of the price-distribution buckets */
const PRICE_BUCKETS = [20, 40, 60, 80] as const;

class AnalyticsService {
  async getMarketSummary() {
    const active = eq(produceListings.status, 'ACTIVE');

    const [[summary], [dist], recent] = await Promise.all([
      db
        .select({
          totalListings: sql<number>`count(*)::int`,
          uniqueProduce: sql<number>`count(distinct ${produceListings.produceType})::int`,
          uniqueLocations: sql<number>`count(distinct ${produceListings.location})::int`,
          avgPrice: sql<number>`coalesce(round(avg(${produceListings.pricePerUnit}), 2), 0)::float`,
        })
        .from(produceListings)
        .where(active),
      db
        .select({
          b0: sql<number>`count(*) filter (where ${produceListings.pricePerUnit} < ${PRICE_BUCKETS[0]})::int`,
          b1: sql<number>`count(*) filter (where ${produceListings.pricePerUnit} >= ${PRICE_BUCKETS[0]} and ${produceListings.pricePerUnit} < ${PRICE_BUCKETS[1]})::int`,
          b2: sql<number>`count(*) filter (where ${produceListings.pricePerUnit} >= ${PRICE_BUCKETS[1]} and ${produceListings.pricePerUnit} < ${PRICE_BUCKETS[2]})::int`,
          b3: sql<number>`count(*) filter (where ${produceListings.pricePerUnit} >= ${PRICE_BUCKETS[2]} and ${produceListings.pricePerUnit} < ${PRICE_BUCKETS[3]})::int`,
          b4: sql<number>`count(*) filter (where ${produceListings.pricePerUnit} >= ${PRICE_BUCKETS[3]})::int`,
        })
        .from(produceListings)
        .where(active),
      db
        .select({ listing: produceListings, farmerName: users.name })
        .from(produceListings)
        .innerJoin(users, eq(produceListings.farmerId, users.id))
        .where(active)
        .orderBy(desc(produceListings.createdAt))
        .limit(5),
    ]);

    return {
      ...summary,
      currency: 'GHS',
      priceDistribution: [
        { range: `0-${PRICE_BUCKETS[0]}`, count: dist.b0 },
        { range: `${PRICE_BUCKETS[0]}-${PRICE_BUCKETS[1]}`, count: dist.b1 },
        { range: `${PRICE_BUCKETS[1]}-${PRICE_BUCKETS[2]}`, count: dist.b2 },
        { range: `${PRICE_BUCKETS[2]}-${PRICE_BUCKETS[3]}`, count: dist.b3 },
        { range: `${PRICE_BUCKETS[3]}+`, count: dist.b4 },
      ],
      recentListings: recent.map((r) => ({ ...toListingDto(r.listing), farmerName: r.farmerName })),
    };
  }

  /** Average / min / max asking price per produce + unit, across active listings */
  async getAveragePrices() {
    return db
      .select({
        produce: produceListings.produceType,
        unit: produceListings.unit,
        avgPrice: sql<number>`round(avg(${produceListings.pricePerUnit}), 2)::float`,
        minPrice: sql<number>`min(${produceListings.pricePerUnit})::float`,
        maxPrice: sql<number>`max(${produceListings.pricePerUnit})::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(produceListings)
      .where(eq(produceListings.status, 'ACTIVE'))
      .groupBy(produceListings.produceType, produceListings.unit)
      .orderBy(produceListings.produceType);
  }

  /**
   * Monthly average asking price for one produce, from every listing ever posted (any status),
   * oldest first. Months with no listings are omitted.
   */
  async getPriceHistory(produce: string, months: number) {
    const month = sql<string>`to_char(date_trunc('month', ${produceListings.createdAt}), 'YYYY-MM')`;
    const since = sql`date_trunc('month', now()) - make_interval(months => ${months - 1})`;
    const like = '%' + produce.replace(/[\\%_]/g, (c) => `\\${c}`) + '%';

    const rows = await db
      .select({
        month,
        avgPrice: sql<number>`round(avg(${produceListings.pricePerUnit}), 2)::float`,
        minPrice: sql<number>`min(${produceListings.pricePerUnit})::float`,
        maxPrice: sql<number>`max(${produceListings.pricePerUnit})::float`,
        listings: sql<number>`count(*)::int`,
      })
      .from(produceListings)
      .where(sql`${produceListings.produceType} ILIKE ${like} AND ${produceListings.createdAt} >= ${since}`)
      .groupBy(month)
      .orderBy(month);

    return { produce, currency: 'GHS', months, history: rows };
  }

  /**
   * Everything the Prices dashboard needs beyond the basic tables: listing activity, the produce-by-town
   * price map, the "priced at or below average" balance, and plain-language insights.
   * Reads the active listings once and works in memory (fine at this scale; move to SQL if listings reach the tens of thousands).
   */
  async getInsights() {
    const active = await db
      .select({
        produceType: produceListings.produceType,
        unit: produceListings.unit,
        location: produceListings.location,
        pricePerUnit: sql<number>`${produceListings.pricePerUnit}::float`,
        isOrganic: produceListings.isOrganic,
      })
      .from(produceListings)
      .where(eq(produceListings.status, 'ACTIVE'));

    const created = produceListings.createdAt;
    const [pulseRow] = await db
      .select({
        newToday: sql<number>`count(*) filter (where ${created} >= date_trunc('day', now()))::int`,
        newYesterday: sql<number>`count(*) filter (where ${created} >= date_trunc('day', now()) - interval '1 day' and ${created} < date_trunc('day', now()))::int`,
        newThisWeek: sql<number>`count(*) filter (where ${created} >= now() - interval '7 days')::int`,
        newLastWeek: sql<number>`count(*) filter (where ${created} >= now() - interval '14 days' and ${created} < now() - interval '7 days')::int`,
      })
      .from(produceListings);

    const monthRows = await db
      .select({
        produceType: produceListings.produceType,
        unit: produceListings.unit,
        month: sql<'current' | 'previous'>`case when ${created} >= date_trunc('month', now()) then 'current' else 'previous' end`,
        avgPrice: sql<number>`avg(${produceListings.pricePerUnit})::float`,
        listings: sql<number>`count(*)::int`,
      })
      .from(produceListings)
      .where(sql`${created} >= date_trunc('month', now()) - interval '1 month'`)
      .groupBy(
        produceListings.produceType,
        produceListings.unit,
        sql`case when ${created} >= date_trunc('month', now()) then 'current' else 'previous' end`,
      );

    const pulse = pulseRow;
    return {
      currency: 'GHS',
      generatedAt: new Date().toISOString(),
      pulse: { ...pulse, weekChangePct: weekChangePct(pulse) },
      balance: buildBalance(active),
      matrix: buildMatrix(active),
      insights: buildInsights(active, monthRows, pulse),
    };
  }

  async getListingsByLocation() {
    return db
      .select({
        location: produceListings.location,
        count: sql<number>`count(*)::int`,
      })
      .from(produceListings)
      .where(eq(produceListings.status, 'ACTIVE'))
      .groupBy(produceListings.location)
      .orderBy(sql`count(*) desc`, produceListings.location);
  }
}

export const analyticsService = new AnalyticsService();
