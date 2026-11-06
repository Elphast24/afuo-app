import { beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, listingBody, login, setup, today, type Session } from './helpers.js';
import { db } from '../../src/db/index.js';
import { produceListings } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

let farmerA: Session; // Accra
let farmerB: Session; // Tamale
let buyer: Session;

const post = (who: Session, body: Record<string, unknown>) =>
  api().post('/v1/listings').set(bearer(who)).send(listingBody(body)).expect(201);

beforeAll(async () => {
  await setup();
  farmerA = await login('0242220001', 'FARMER', 'Akosua Owusu');
  farmerB = await login('0242220002', 'FARMER', 'Ama Serwaa');
  buyer = await login('0502220001', 'BUYER', 'Efua Quaye');

  await post(farmerA, { produceType: 'Tomatoes', quantity: 300, pricePerUnit: 24, location: 'Accra' });
  await post(farmerB, { produceType: 'Tomatoes', quantity: 900, pricePerUnit: 18, location: 'Tamale', isOrganic: true });
  await post(farmerA, { produceType: 'Onions', quantity: 500, pricePerUnit: 15, location: 'Accra' });
  await post(farmerB, { produceType: 'Maize', unit: 'BAGS_90KG', quantity: 100, pricePerUnit: 450, location: 'Tamale' });
});

const match = (body: Record<string, unknown>) => api().post('/v1/match').set(bearer(buyer)).send(body);

describe('POST /match', () => {
  it('ranks by the weighted score and explains it', async () => {
    const res = await match({ produce: 'Tomatoes', quantity: 300, maxPrice: 25, location: 'Accra' }).expect(200);
    const { results, totalMatches, normalizedWeights } = res.body.data;

    expect(totalMatches).toBe(2); // onions and maize are excluded: produce score 0
    expect(results.map((r: any) => r.rank)).toEqual([1, 2]);
    expect(results[0].listing.location).toBe('Accra'); // same town, exact quantity
    expect(results[0].matchScore).toBeGreaterThan(results[1].matchScore);
    expect(results[0].distance).toBe(0);
    expect(results[1].distance).toBeGreaterThan(400); // Accra to Tamale

    expect(results[0].breakdown).toEqual({
      produceScore: 100,
      quantityScore: 100,
      locationScore: 100,
      priceScore: 99, // 24 of a 25 budget
      availabilityScore: 70, // no needed-by date: neutral
    });
    expect(results[0]).toMatchObject({ matchTier: 'EXCELLENT', matchPercentage: expect.any(Number) });
    expect(results[0].listing.farmer).toMatchObject({ name: 'Akosua Owusu', phone: farmerA.phone });

    expect(Object.values(normalizedWeights as Record<string, number>).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
  });

  it('matches the documented score formula', async () => {
    const res = await match({
      produce: 'Tomatoes', quantity: 300, maxPrice: 25, location: 'Accra',
      weights: { produce: 30, quantity: 20, location: 25, price: 15, availability: 10 },
    }).expect(200);
    const r = res.body.data.results[0];
    // 0.30*1 + 0.20*1 + 0.25*1 + 0.15*0.99 + 0.10*0.7 = 0.9685 (price 1 - 0.25*(1/25) = 0.99)
    expect(r.matchScore).toBeCloseTo(0.9685, 2); // stored to 3 decimals
    expect(r.matchPercentage).toBe(97);
  });

  it('lets the buyer shift the weights', async () => {
    const priceFirst = await match({
      produce: 'Tomatoes', quantity: 300, maxPrice: 25, location: 'Accra',
      weights: { produce: 0, quantity: 0, location: 0, price: 100, availability: 0 },
    }).expect(200);
    expect(priceFirst.body.data.normalizedWeights).toEqual({ produce: 0, quantity: 0, location: 0, price: 1, availability: 0 });
    // under a price-only ranking both are inside budget; the closer-to-budget Accra one still scores higher
    expect(priceFirst.body.data.results[0].matchScore).toBeGreaterThanOrEqual(priceFirst.body.data.results[1].matchScore);

    const nearest = await match({
      produce: 'Tomatoes', location: 'Tamale',
      weights: { produce: 0, quantity: 0, location: 100, price: 0, availability: 0 },
    }).expect(200);
    expect(nearest.body.data.results[0].listing.location).toBe('Tamale');
  });

  it('uses explicit coordinates over a location name', async () => {
    const res = await match({ produce: 'Maize', latitude: 9.4034, longitude: -0.8424 }).expect(200);
    expect(res.body.data.results[0].distance).toBe(0);
  });

  it('ranks near-miss spellings lower instead of dropping them', async () => {
    const res = await match({ produce: 'Tomatos' }).expect(200);
    expect(res.body.data.results).toHaveLength(2);
    expect(res.body.data.results[0].breakdown.produceScore).toBe(30);
  });

  it('with no produce, scores everything neutrally on produce', async () => {
    const res = await match({}).expect(200);
    expect(res.body.data.totalMatches).toBe(4);
    expect(res.body.data.results[0].distance).toBeNull();
  });

  it('applies organicOnly, limit, and requiredBy', async () => {
    const organic = await match({ produce: 'Tomatoes', organicOnly: true }).expect(200);
    expect(organic.body.data.results).toHaveLength(1);
    expect(organic.body.data.results[0].listing.farmer.name).toBe('Ama Serwaa');

    const limited = await match({ limit: 1 }).expect(200);
    expect(limited.body.data.results).toHaveLength(1);
    expect(limited.body.data.totalMatches).toBe(4);

    const inWindow = await match({ produce: 'Maize', requiredBy: today(10) }).expect(200);
    expect(inWindow.body.data.results[0].breakdown.availabilityScore).toBe(100);
    const late = await match({ produce: 'Maize', requiredBy: today(200) }).expect(200);
    expect(late.body.data.results[0].breakdown.availabilityScore).toBe(5);
  });

  it('skips listings that are not ACTIVE', async () => {
    const made = await post(farmerA, { produceType: 'Cassava' });
    await api().patch(`/v1/listings/${made.body.data.listing.id}`).set(bearer(farmerA)).send({ status: 'DEACTIVATED' }).expect(200);
    const res = await match({ produce: 'Cassava' }).expect(200);
    expect(res.body.data.totalMatches).toBe(0);
  });

  it('validates the request', async () => {
    await match({ quantity: -5 }).expect(422);
    await match({ requiredBy: 'tomorrow' }).expect(422);
    await match({ weights: { colour: 5 } }).expect(422);
    await match({ weights: { produce: -1 } }).expect(422);
    await match({ limit: 0 }).expect(422);
    await match({ latitude: 5 }).expect(422);
  });
});

describe('analytics', () => {
  const get = (p: string) => api().get(`/v1/analytics${p}`).set(bearer(buyer)).expect(200);

  beforeAll(async () => {
    // Backdate a few listings so the history has several months
    const rows = await db.select().from(produceListings).where(eq(produceListings.produceType, 'Tomatoes'));
    const months = [4, 2];
    for (let i = 0; i < months.length; i++) {
      const when = new Date(Date.now() - months[i] * 30 * 86_400_000);
      await db
        .update(produceListings)
        .set({ createdAt: when, pricePerUnit: String(10 + i * 5) })
        .where(eq(produceListings.id, rows[i].id));
    }
  });

  it('GET /analytics/summary', async () => {
    const { data } = (await get('/summary')).body;
    expect(data).toMatchObject({ totalListings: 4, uniqueProduce: 3, uniqueLocations: 2, currency: 'GHS' });
    expect(data.avgPrice).toBeGreaterThan(0);
    expect(data.priceDistribution.map((b: any) => b.range)).toEqual(['0-20', '20-40', '40-60', '60-80', '80+']);
    expect(data.priceDistribution.reduce((n: number, b: any) => n + b.count, 0)).toBe(4);
    expect(data.recentListings.length).toBeGreaterThan(0);
    expect(data.recentListings[0]).toHaveProperty('farmerName');
  });

  it('GET /analytics/prices', async () => {
    const { prices } = (await get('/prices')).body.data;
    const maize = prices.find((p: any) => p.produce === 'Maize');
    expect(maize).toMatchObject({ unit: 'BAGS_90KG', avgPrice: 450, minPrice: 450, maxPrice: 450, count: 1 });
  });

  it('GET /analytics/prices/:produce gives a monthly history, oldest first', async () => {
    const { data } = (await get('/prices/Tomatoes?months=6')).body;
    expect(data).toMatchObject({ produce: 'Tomatoes', currency: 'GHS', months: 6 });
    expect(data.history.length).toBeGreaterThanOrEqual(2);
    const months = data.history.map((h: any) => h.month);
    expect(months).toEqual([...months].sort());
    expect(data.history[0]).toMatchObject({ listings: expect.any(Number), avgPrice: expect.any(Number) });

    // Both tomato listings were backdated, so the current month has none; maize was posted just now
    expect((await get('/prices/Tomatoes?months=1')).body.data.history).toEqual([]);
    expect((await get('/prices/Maize?months=1')).body.data.history).toHaveLength(1);

    const none = (await get('/prices/Dragonfruit')).body.data;
    expect(none.history).toEqual([]);
  });

  it('GET /analytics/prices/:produce validates months', async () => {
    await api().get('/v1/analytics/prices/Tomatoes?months=99').set(bearer(buyer)).expect(422);
  });

  it('GET /analytics/locations', async () => {
    const { locations } = (await get('/locations')).body.data;
    expect(locations).toEqual([
      { location: 'Accra', count: 2 },
      { location: 'Tamale', count: 2 },
    ]);
  });
});
