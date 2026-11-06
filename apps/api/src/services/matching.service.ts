/*
  Weighted Multi-Criteria Scoring (WMCS), section 7 of the project documentation.

    MatchScore = sum_i (w_i * s_i)   i in {produce, quantity, location, price, availability}
    w_i normalised so sum(w_i) = 1, each s_i in [0, 1]
*/
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { produceListings, users } from '../db/schema.js';
import { haversine } from '../utils/haversine.js';
import { levenshtein } from '../utils/levenshtein.js';
import { findCity } from '../utils/ghana.js';
import type { MatchQuery, MatchResult, MatchTier, MatchWeights } from '../types/match.types.js';

export const DEFAULT_WEIGHTS: MatchWeights = { produce: 30, quantity: 20, location: 25, price: 15, availability: 10 };

const DAY_MS = 86_400_000;
const has = (n: number | null | undefined): n is number => n !== null && n !== undefined && Number.isFinite(n);

export class MatchingService {
  async findMatches(query: MatchQuery): Promise<{ normalizedWeights: MatchWeights; results: MatchResult[]; totalMatches: number }> {
    const weights = this.normalizeWeights(query.weights);

    // The buyer's position: explicit coordinates, else a known Ghana town name
    let { latitude, longitude } = query;
    if (!has(latitude) || !has(longitude)) {
      const city = findCity(query.location);
      if (city) ({ latitude, longitude } = city);
    }

    const conditions = [eq(produceListings.status, 'ACTIVE')];
    if (query.organicOnly) conditions.push(eq(produceListings.isOrganic, true));

    // Produce is scored (exact / partial / fuzzy), not pre-filtered in SQL, so near-misses like "Tomatos" still rank
    const rows = await db
      .select({
        listing: produceListings,
        farmer: { id: users.id, name: users.name, phone: users.phone, avatarUrl: users.avatarUrl },
      })
      .from(produceListings)
      .innerJoin(users, eq(produceListings.farmerId, users.id))
      .where(and(...conditions));

    const needed = query.requiredBy ? new Date(query.requiredBy) : null;
    const scored: Omit<MatchResult, 'rank'>[] = [];

    for (const { listing, farmer } of rows) {
      const produceScore = this.calcProduceScore(query.produce, listing.produceType);
      if (produceScore === 0 && query.produce) continue;

      const lat = Number(listing.latitude);
      const lng = Number(listing.longitude);

      const quantityScore = this.calcQuantityScore(query.quantity, Number(listing.quantity));
      const locationScore = this.calcLocationScore(latitude, longitude, lat, lng);
      const priceScore = this.calcPriceScore(query.maxPrice, Number(listing.pricePerUnit));
      const availabilityScore = this.calcAvailabilityScore(
        needed,
        new Date(listing.availableFrom),
        new Date(listing.availableTo)
      );

      const total =
        weights.produce * produceScore +
        weights.quantity * quantityScore +
        weights.location * locationScore +
        weights.price * priceScore +
        weights.availability * availabilityScore;

      scored.push({
        matchScore: Math.round(total * 1000) / 1000,
        matchPercentage: Math.round(total * 100),
        matchTier: this.classifyTier(total),
        distance: has(latitude) && has(longitude) ? Math.round(haversine(latitude, longitude, lat, lng)) : null,
        breakdown: {
          produceScore: Math.round(produceScore * 100),
          quantityScore: Math.round(quantityScore * 100),
          locationScore: Math.round(locationScore * 100),
          priceScore: Math.round(priceScore * 100),
          availabilityScore: Math.round(availabilityScore * 100),
        },
        listing: {
          id: listing.id,
          produceType: listing.produceType,
          category: listing.category,
          quantity: Number(listing.quantity),
          unit: listing.unit,
          pricePerUnit: Number(listing.pricePerUnit),
          currency: listing.currency,
          location: listing.location,
          latitude: lat,
          longitude: lng,
          availableFrom: listing.availableFrom,
          availableTo: listing.availableTo,
          isOrganic: listing.isOrganic,
          description: listing.description,
          farmer,
        },
      });
    }

    scored.sort((a, b) => b.matchScore - a.matchScore || (a.distance ?? Infinity) - (b.distance ?? Infinity));

    const results = scored.slice(0, query.limit ?? 20).map((r, i) => ({ ...r, rank: i + 1 }));
    return { normalizedWeights: weights, results, totalMatches: scored.length };
  }

  /** Any scale in, weights summing to 1 out. Negative values count as 0; all-zero falls back to the defaults. */
  normalizeWeights(input?: Partial<MatchWeights>): MatchWeights {
    const raw: MatchWeights = { ...DEFAULT_WEIGHTS };
    if (input) {
      for (const key of Object.keys(DEFAULT_WEIGHTS) as (keyof MatchWeights)[]) {
        const v = input[key];
        if (v !== undefined) raw[key] = Number.isFinite(v) ? Math.max(0, v) : 0;
      }
    }
    let sum = raw.produce + raw.quantity + raw.location + raw.price + raw.availability;
    const source = sum > 0 ? raw : DEFAULT_WEIGHTS;
    sum = source.produce + source.quantity + source.location + source.price + source.availability;

    const round = (n: number) => Math.round((n / sum) * 10_000) / 10_000;
    return {
      produce: round(source.produce),
      quantity: round(source.quantity),
      location: round(source.location),
      price: round(source.price),
      availability: round(source.availability),
    };
  }

  // ─── Scoring functions (section 7.3) ───

  private calcProduceScore(query: string | undefined, listing: string): number {
    if (!query) return 0.5;
    const q = query.toLowerCase().trim();
    const l = listing.toLowerCase().trim();
    if (!q) return 0.5;
    if (q === l) return 1.0;
    if (l.includes(q) || q.includes(l)) return 0.5;
    if (levenshtein(q, l) <= 2) return 0.3;
    return 0.0;
  }

  private calcQuantityScore(need: number | undefined, have: number): number {
    if (!need || need <= 0) return 0.7;
    if (have >= need) {
      const surplusRatio = (have - need) / need;
      return Math.max(0.3, 1.0 - 0.15 * surplusRatio);
    }
    return have / need;
  }

  private calcLocationScore(
    buyerLat: number | null | undefined,
    buyerLng: number | null | undefined,
    farmerLat: number,
    farmerLng: number
  ): number {
    if (!has(buyerLat) || !has(buyerLng)) return 0.5;
    const dist = haversine(buyerLat, buyerLng, farmerLat, farmerLng);
    if (dist <= 10) return 1.0;
    if (dist <= 30) return 0.9;
    if (dist <= 50) return 0.75;
    if (dist <= 100) return 0.55;
    if (dist <= 200) return 0.35;
    if (dist <= 500) return 0.15;
    return 0.05;
  }

  private calcPriceScore(maxBudget: number | undefined, askPrice: number): number {
    if (!maxBudget || maxBudget <= 0) return 0.7;
    if (askPrice <= maxBudget) {
      const savingsRatio = (maxBudget - askPrice) / maxBudget;
      return Math.max(0.5, 1.0 - 0.25 * savingsRatio);
    }
    const overageRatio = (askPrice - maxBudget) / maxBudget;
    return Math.max(0.0, 1.0 - 1.5 * overageRatio);
  }

  private calcAvailabilityScore(needed: Date | null, from: Date, to: Date): number {
    if (!needed || Number.isNaN(needed.getTime())) return 0.7;
    const n = needed.getTime();
    const f = from.getTime();
    const t = to.getTime();
    if (n >= f && n <= t) return 1.0;
    const gap = n < f ? (f - n) / DAY_MS : (n - t) / DAY_MS;
    if (gap <= 3) return 0.85;
    if (gap <= 7) return 0.65;
    if (gap <= 14) return 0.4;
    if (gap <= 30) return 0.2;
    return 0.05;
  }

  // ─── Tiers (section 7.4) ───

  private classifyTier(score: number): MatchTier {
    if (score >= 0.8) return 'EXCELLENT';
    if (score >= 0.6) return 'GOOD';
    if (score >= 0.4) return 'FAIR';
    return 'POOR';
  }
}

export const matchingService = new MatchingService();
