import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { api, bearer, listingBody, login, png, setup, today, type Session } from './helpers.js';
import { config } from '../../src/config/index.js';

let farmer: Session;
let farmer2: Session;
let buyer: Session;

beforeAll(async () => {
  await setup();
  farmer = await login('0241110001', 'FARMER', 'Kwame Mensah');
  farmer2 = await login('0241110002', 'FARMER', 'Ama Serwaa');
  buyer = await login('0501110001', 'BUYER', 'Efua Quaye');
});

afterAll(async () => {
  await fs.rm(path.resolve(config.uploadDir), { recursive: true, force: true });
});

describe('POST /listings', () => {
  it('farmers create a listing; coordinates and category are filled in', async () => {
    const res = await api().post('/v1/listings').set(bearer(farmer)).send(listingBody()).expect(201);
    const l = res.body.data.listing;
    expect(l).toMatchObject({
      produceType: 'Tomatoes',
      category: 'VEGETABLES',
      quantity: 500,
      pricePerUnit: 22,
      currency: 'GHS',
      location: 'Accra',
      status: 'ACTIVE',
      viewCount: 0,
      farmerId: farmer.userId,
    });
    expect(l.latitude).toBeCloseTo(5.6037, 3);
    expect(l.longitude).toBeCloseTo(-0.187, 3);
  });

  it('accepts explicit coordinates for places outside the known towns', async () => {
    const res = await api()
      .post('/v1/listings')
      .set(bearer(farmer))
      .send(listingBody({ location: 'Ejura', latitude: 7.38, longitude: -1.36, produceType: 'Yam' }))
      .expect(201);
    expect(res.body.data.listing).toMatchObject({ location: 'Ejura', latitude: 7.38, category: 'VEGETABLES' });
  });

  it('buyers cannot create listings', async () => {
    const res = await api().post('/v1/listings').set(bearer(buyer)).send(listingBody()).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates input with field-level details', async () => {
    const res = await api()
      .post('/v1/listings')
      .set(bearer(farmer))
      .send(
        listingBody({
          quantity: -1,
          unit: 'TRUCKS',
          availableFrom: '2026-02-30',
          availableTo: today(-10),
          pricePerUnit: 'lots',
        })
      )
      .expect(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['quantity', 'unit', 'availableFrom', 'pricePerUnit']));
  });

  it('rejects a window that ends before it starts', async () => {
    const res = await api()
      .post('/v1/listings')
      .set(bearer(farmer))
      .send(listingBody({ availableFrom: today(10), availableTo: today(2) }))
      .expect(422);
    expect(res.body.error.details[0].field).toBe('availableTo');
  });

  it('rejects an unknown town without coordinates', async () => {
    const res = await api()
      .post('/v1/listings')
      .set(bearer(farmer))
      .send(listingBody({ location: 'Atlantis' }))
      .expect(400);
    expect(res.body.error.message).toMatch(/Unknown location/);
  });

  it('rejects lat without lng, non-JSON and oversized bodies', async () => {
    await api().post('/v1/listings').set(bearer(farmer)).send(listingBody({ latitude: 5 })).expect(422);
    const bad = await api()
      .post('/v1/listings')
      .set(bearer(farmer))
      .set('Content-Type', 'application/json')
      .send('{not json')
      .expect(400);
    expect(bad.body.error.code).toBe('INVALID_JSON');
    const big = await api()
      .post('/v1/listings')
      .set(bearer(farmer))
      .send(listingBody({ description: 'x'.repeat(11_000) }))
      .expect(413);
    expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('GET /listings (browse)', () => {
  beforeAll(async () => {
    const make = (over: Record<string, unknown>, who = farmer2) =>
      api().post('/v1/listings').set(bearer(who)).send(listingBody(over)).expect(201);
    await make({ produceType: 'Maize', unit: 'BAGS_90KG', quantity: 100, pricePerUnit: 450, location: 'Tamale', isOrganic: true });
    await make({ produceType: 'Cassava', quantity: 2000, pricePerUnit: 4, location: 'Kumasi' });
    await make({ produceType: 'Plantain', unit: 'BUNCHES', quantity: 300, pricePerUnit: 38, location: 'Kumasi' });
    await make({ produceType: 'Okra', quantity: 150, pricePerUnit: 14, location: 'Accra', isOrganic: true });
  });

  const list = (qs = '') => api().get(`/v1/listings${qs}`).set(bearer(buyer)).expect(200);

  it('paginates', async () => {
    const all = await list();
    const total = all.body.data.pagination.total;
    expect(total).toBeGreaterThanOrEqual(6);

    const page = await list('?limit=2&page=2');
    expect(page.body.data.items).toHaveLength(2);
    expect(page.body.data.pagination).toMatchObject({ page: 2, limit: 2, total, totalPages: Math.ceil(total / 2) });
  });

  it('filters by produce, category, location, quantity, price and organic', async () => {
    expect((await list('?produce=maiz')).body.data.items.map((i: any) => i.produceType)).toEqual(['Maize']);
    expect((await list('?category=GRAINS')).body.data.items).toHaveLength(1);
    expect((await list('?location=kumasi')).body.data.items).toHaveLength(2);
    expect((await list('?minQuantity=1000')).body.data.items.map((i: any) => i.produceType)).toEqual(['Cassava']);
    expect((await list('?maxPrice=10')).body.data.items.map((i: any) => i.produceType)).toEqual(['Cassava']);
    const organic = (await list('?organic=true')).body.data.items.map((i: any) => i.produceType).sort();
    expect(organic).toEqual(['Maize', 'Okra']);
  });

  it('treats % and _ in search text literally', async () => {
    expect((await list('?produce=%25')).body.data.items).toHaveLength(0);
  });

  it('includes the farmer name but not their phone', async () => {
    const item = (await list('?produce=maize')).body.data.items[0];
    expect(item.farmer).toEqual({ id: farmer2.userId, name: 'Ama Serwaa' });
    expect(item.imageUrl).toBeNull();
  });

  it('validates query params', async () => {
    await api().get('/v1/listings?limit=1000').set(bearer(buyer)).expect(422);
    await api().get('/v1/listings?category=GOLD').set(bearer(buyer)).expect(422);
    await api().get('/v1/listings?page=0').set(bearer(buyer)).expect(422);
  });
});

describe('GET /listings/my and /listings/:id', () => {
  it('/my returns only the farmers own listings (and is not read as an id)', async () => {
    const res = await api().get('/v1/listings/my').set(bearer(farmer)).expect(200);
    expect(res.body.data.listings.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.listings.every((l: any) => l.farmerId === farmer.userId)).toBe(true);
    await api().get('/v1/listings/my').set(bearer(buyer)).expect(403);
  });

  it('returns details, counts views by others only, and shows the phone to signed-in users', async () => {
    const created = await api().post('/v1/listings').set(bearer(farmer)).send(listingBody({ produceType: 'Onions' })).expect(201);
    const id = created.body.data.listing.id;

    const own = await api().get(`/v1/listings/${id}`).set(bearer(farmer)).expect(200);
    expect(own.body.data.listing.viewCount).toBe(0);

    const seen = await api().get(`/v1/listings/${id}`).set(bearer(buyer)).expect(200);
    expect(seen.body.data.listing.viewCount).toBe(1);
    expect(seen.body.data.listing.farmer).toMatchObject({ id: farmer.userId, phone: farmer.phone });
    expect(seen.body.data.listing.images).toEqual([]);

    const mine = await api().get('/v1/listings/my').set(bearer(farmer)).expect(200);
    expect(mine.body.data.listings.find((l: any) => l.id === id).viewCount).toBe(1);
  });

  it('404 for a missing listing, 422 for a malformed id', async () => {
    await api().get('/v1/listings/00000000-0000-4000-8000-000000000000').set(bearer(buyer)).expect(404);
    await api().get('/v1/listings/not-a-uuid').set(bearer(buyer)).expect(422);
  });
});

describe('PATCH and DELETE /listings/:id', () => {
  it('only the owner can change or delete', async () => {
    const created = await api().post('/v1/listings').set(bearer(farmer)).send(listingBody({ produceType: 'Carrots' })).expect(201);
    const id = created.body.data.listing.id;

    await api().patch(`/v1/listings/${id}`).set(bearer(farmer2)).send({ pricePerUnit: 1 }).expect(403);
    await api().delete(`/v1/listings/${id}`).set(bearer(farmer2)).expect(403);

    const upd = await api()
      .patch(`/v1/listings/${id}`)
      .set(bearer(farmer))
      .send({ pricePerUnit: 25.5, status: 'SOLD', location: 'Kumasi', description: null })
      .expect(200);
    expect(upd.body.data.listing).toMatchObject({ pricePerUnit: 25.5, status: 'SOLD', location: 'Kumasi', description: null });
    expect(upd.body.data.listing.latitude).toBeCloseTo(6.6885, 3); // re-resolved from the new town

    // a sold listing drops out of the default (ACTIVE) browse
    const browse = await api().get('/v1/listings?produce=Carrots').set(bearer(buyer)).expect(200);
    expect(browse.body.data.items).toHaveLength(0);
    const sold = await api().get('/v1/listings?produce=Carrots&status=SOLD').set(bearer(buyer)).expect(200);
    expect(sold.body.data.items).toHaveLength(1);

    await api().patch(`/v1/listings/${id}`).set(bearer(farmer)).send({}).expect(422);
    await api().patch(`/v1/listings/${id}`).set(bearer(farmer)).send({ availableTo: '2000-01-01' }).expect(400);

    await api().delete(`/v1/listings/${id}`).set(bearer(farmer)).expect(200);
    await api().get(`/v1/listings/${id}`).set(bearer(buyer)).expect(404);
  });
});

describe('listing images', () => {
  let id: string;
  beforeAll(async () => {
    const created = await api().post('/v1/listings').set(bearer(farmer)).send(listingBody({ produceType: 'Pepper' })).expect(201);
    id = created.body.data.listing.id;
  });

  it('uploads, re-encodes to WebP, serves the file, and marks the first as primary', async () => {
    const img = await png();
    const res = await api()
      .post(`/v1/listings/${id}/images`)
      .set(bearer(farmer))
      .attach('images', img, { filename: 'a.png', contentType: 'image/png' })
      .attach('images', img, { filename: 'b.png', contentType: 'image/png' })
      .expect(201);

    const images = res.body.data.images;
    expect(images).toHaveLength(2);
    expect(images[0]).toMatchObject({ isPrimary: true, sortOrder: 0 });
    expect(images[1]).toMatchObject({ isPrimary: false, sortOrder: 1 });
    expect(images[0].url).toMatch(new RegExp(`^/uploads/listings/${id}/.+\\.webp$`));

    const file = await api().get(images[0].url).expect(200);
    expect(file.headers['content-type']).toBe('image/webp');
    expect(file.headers['cross-origin-resource-policy']).toBe('cross-origin');

    const detail = await api().get(`/v1/listings/${id}`).set(bearer(buyer)).expect(200);
    expect(detail.body.data.listing.images).toHaveLength(2);

    const browse = await api().get('/v1/listings?produce=Pepper').set(bearer(buyer)).expect(200);
    expect(browse.body.data.items[0].imageUrl).toBe(images[0].url);
  });

  it('enforces the 5 image limit across uploads', async () => {
    const img = await png();
    const req = () =>
      api().post(`/v1/listings/${id}/images`).set(bearer(farmer)).attach('images', img, { filename: 'c.png', contentType: 'image/png' });
    await req().expect(201);
    await req().expect(201);
    await req().expect(201); // 5 now
    const over = await req().expect(400);
    expect(over.body.error.message).toMatch(/at most 5/);
  });

  it('rejects wrong types, fake images, oversize files, empty uploads and non-owners', async () => {
    const other = (await api().post('/v1/listings').set(bearer(farmer)).send(listingBody({ produceType: 'Rice' })).expect(201)).body.data.listing.id;

    const txt = await api()
      .post(`/v1/listings/${other}/images`)
      .set(bearer(farmer))
      .attach('images', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' })
      .expect(400);
    expect(txt.body.error.message).toMatch(/JPEG, PNG or WebP/);

    const fake = await api()
      .post(`/v1/listings/${other}/images`)
      .set(bearer(farmer))
      .attach('images', Buffer.from('definitely not a png'), { filename: 'a.png', contentType: 'image/png' })
      .expect(400);
    expect(fake.body.error.message).toMatch(/not a valid image/);

    const big = await api()
      .post(`/v1/listings/${other}/images`)
      .set(bearer(farmer))
      .attach('images', Buffer.alloc(5 * 1024 * 1024 + 10), { filename: 'big.png', contentType: 'image/png' })
      .expect(413);
    expect(big.body.error.code).toBe('FILE_TOO_LARGE');

    await api().post(`/v1/listings/${other}/images`).set(bearer(farmer)).expect(400);

    await api()
      .post(`/v1/listings/${other}/images`)
      .set(bearer(farmer2))
      .attach('images', await png(), { filename: 'a.png', contentType: 'image/png' })
      .expect(403);
  });

  it('deletes an image, promotes the next one to primary, and removes the file', async () => {
    const detail = await api().get(`/v1/listings/${id}`).set(bearer(farmer)).expect(200);
    const [first, second] = detail.body.data.listing.images;
    expect(first.isPrimary).toBe(true);

    await api().delete(`/v1/listings/${id}/images/${first.id}`).set(bearer(farmer2)).expect(403);
    await api().delete(`/v1/listings/${id}/images/${first.id}`).set(bearer(farmer)).expect(200);

    await api().get(first.url).expect(404);
    const after = await api().get(`/v1/listings/${id}`).set(bearer(farmer)).expect(200);
    expect(after.body.data.listing.images[0]).toMatchObject({ id: second.id, isPrimary: true });

    await api().delete(`/v1/listings/${id}/images/${first.id}`).set(bearer(farmer)).expect(404);
  });

  it('deleting a listing removes its image files', async () => {
    const created = (await api().post('/v1/listings').set(bearer(farmer)).send(listingBody({ produceType: 'Soybeans' })).expect(201)).body.data.listing.id;
    const up = await api()
      .post(`/v1/listings/${created}/images`)
      .set(bearer(farmer))
      .attach('images', await png(), { filename: 'a.png', contentType: 'image/png' })
      .expect(201);
    await api().get(up.body.data.images[0].url).expect(200);
    await api().delete(`/v1/listings/${created}`).set(bearer(farmer)).expect(200);
    await api().get(up.body.data.images[0].url).expect(404);
  });
});
