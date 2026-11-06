import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { api, app, bearer, listingBody, login, setup, type Session } from './helpers.js';
import { realtime } from '../../src/websocket/index.js';

let farmer: Session;
let buyer: Session;
let buyer2: Session;
let outsider: Session;
let listingId: string;
let conversationId: string;

beforeAll(async () => {
  await setup();
  farmer = await login('0243330001', 'FARMER', 'Kofi Boateng');
  buyer = await login('0503330001', 'BUYER', 'Efua Quaye');
  buyer2 = await login('0503330002', 'BUYER', 'Nana Adjei');
  outsider = await login('0503330003', 'BUYER', 'Not Involved');
  const res = await api().post('/v1/listings').set(bearer(farmer)).send(listingBody({ produceType: 'Plantain', unit: 'BUNCHES' })).expect(201);
  listingId = res.body.data.listing.id;
});

describe('conversations', () => {
  it('a buyer starts a conversation with a first message; repeating returns the same one', async () => {
    const res = await api()
      .post('/v1/conversations')
      .set(bearer(buyer))
      .send({ listingId, message: 'Hello, is the plantain still available?' })
      .expect(201);
    expect(res.body.data.created).toBe(true);
    expect(res.body.data.message).toMatchObject({ senderId: buyer.userId, content: 'Hello, is the plantain still available?', readAt: null });
    conversationId = res.body.data.conversation.id;

    const again = await api().post('/v1/conversations').set(bearer(buyer)).send({ listingId }).expect(200);
    expect(again.body.data.created).toBe(false);
    expect(again.body.data.conversation.id).toBe(conversationId);
    expect(again.body.data.message).toBeNull();
  });

  it('farmers cannot message their own listing; unknown listings 404; bad input 422', async () => {
    const own = await api().post('/v1/conversations').set(bearer(farmer)).send({ listingId }).expect(403);
    expect(own.body.error.code).toBe('FORBIDDEN');
    await api().post('/v1/conversations').set(bearer(buyer)).send({ listingId: '00000000-0000-4000-8000-000000000000' }).expect(404);
    await api().post('/v1/conversations').set(bearer(buyer)).send({ listingId: 'abc' }).expect(422);
    await api().post('/v1/conversations').set(bearer(buyer)).send({ listingId, message: '   ' }).expect(422);
  });

  it('GET /conversations lists both sides with last message and unread counts', async () => {
    const farmerView = await api().get('/v1/conversations').set(bearer(farmer)).expect(200);
    expect(farmerView.body.data.conversations).toHaveLength(1);
    expect(farmerView.body.data.conversations[0]).toMatchObject({
      id: conversationId,
      unreadCount: 1,
      listing: { id: listingId, produceType: 'Plantain' },
      buyer: { id: buyer.userId, name: 'Efua Quaye' },
      farmer: { id: farmer.userId, name: 'Kofi Boateng' },
      lastMessage: { content: 'Hello, is the plantain still available?', senderId: buyer.userId },
    });

    const buyerView = await api().get('/v1/conversations').set(bearer(buyer)).expect(200);
    expect(buyerView.body.data.conversations[0].unreadCount).toBe(0);

    const none = await api().get('/v1/conversations').set(bearer(outsider)).expect(200);
    expect(none.body.data.conversations).toEqual([]);
  });

  it('messages: send, list oldest first, page back with ?before', async () => {
    await api().post(`/v1/conversations/${conversationId}/messages`).set(bearer(farmer)).send({ content: 'Yes, 300 bunches.' }).expect(201);
    await api().post(`/v1/conversations/${conversationId}/messages`).set(bearer(buyer)).send({ content: 'GHS 36 per bunch?' }).expect(201);

    const all = await api().get(`/v1/conversations/${conversationId}/messages`).set(bearer(buyer)).expect(200);
    expect(all.body.data.messages.map((m: any) => m.content)).toEqual([
      'Hello, is the plantain still available?',
      'Yes, 300 bunches.',
      'GHS 36 per bunch?',
    ]);

    const last2 = await api().get(`/v1/conversations/${conversationId}/messages?limit=2`).set(bearer(buyer)).expect(200);
    expect(last2.body.data.messages.map((m: any) => m.content)).toEqual(['Yes, 300 bunches.', 'GHS 36 per bunch?']);

    const older = await api()
      .get(`/v1/conversations/${conversationId}/messages?limit=5&before=${encodeURIComponent(last2.body.data.messages[0].createdAt)}`)
      .set(bearer(buyer))
      .expect(200);
    expect(older.body.data.messages.map((m: any) => m.content)).toEqual(['Hello, is the plantain still available?']);

    await api().post(`/v1/conversations/${conversationId}/messages`).set(bearer(farmer)).send({ content: '' }).expect(422);
    await api().post(`/v1/conversations/${conversationId}/messages`).set(bearer(farmer)).send({ content: 'x'.repeat(2001) }).expect(422);
    await api().get(`/v1/conversations/${conversationId}/messages?limit=500`).set(bearer(buyer)).expect(422);
  });

  it('PATCH /read marks only the other persons messages', async () => {
    const res = await api().patch(`/v1/conversations/${conversationId}/read`).set(bearer(farmer)).expect(200);
    expect(res.body.data.updated).toBe(2); // the buyer's two messages

    const list = await api().get('/v1/conversations').set(bearer(farmer)).expect(200);
    expect(list.body.data.conversations[0].unreadCount).toBe(0);

    const buyerList = await api().get('/v1/conversations').set(bearer(buyer)).expect(200);
    expect(buyerList.body.data.conversations[0].unreadCount).toBe(1); // the farmer's reply is still unread

    const again = await api().patch(`/v1/conversations/${conversationId}/read`).set(bearer(farmer)).expect(200);
    expect(again.body.data.updated).toBe(0);
  });

  it('outsiders get 404, not 403, so conversation ids cannot be probed', async () => {
    await api().get(`/v1/conversations/${conversationId}/messages`).set(bearer(outsider)).expect(404);
    await api().post(`/v1/conversations/${conversationId}/messages`).set(bearer(outsider)).send({ content: 'hi' }).expect(404);
    await api().patch(`/v1/conversations/${conversationId}/read`).set(bearer(outsider)).expect(404);
  });

  it('orders conversations by latest activity', async () => {
    const second = await api().post('/v1/conversations').set(bearer(buyer2)).send({ listingId, message: 'Newest' }).expect(201);
    const list = await api().get('/v1/conversations').set(bearer(farmer)).expect(200);
    expect(list.body.data.conversations.map((c: any) => c.id)).toEqual([second.body.data.conversation.id, conversationId]);
  });
});

describe('reviews', () => {
  it('a buyer who contacted the farmer can review them, once', async () => {
    const res = await api().post('/v1/reviews').set(bearer(buyer)).send({ listingId, rating: 5, comment: 'Fair price, quick reply' }).expect(201);
    expect(res.body.data.review).toMatchObject({ reviewerId: buyer.userId, revieweeId: farmer.userId, rating: 5 });
    const dup = await api().post('/v1/reviews').set(bearer(buyer)).send({ listingId, rating: 1 }).expect(409);
    expect(dup.body.error.code).toBe('CONFLICT');
  });

  it('the farmer can review a buyer who contacted them (and must say which)', async () => {
    await api().post('/v1/reviews').set(bearer(farmer)).send({ listingId, rating: 4 }).expect(403);
    await api().post('/v1/reviews').set(bearer(farmer)).send({ listingId, buyerId: outsider.userId, rating: 4 }).expect(403);
    await api().post('/v1/reviews').set(bearer(farmer)).send({ listingId, buyerId: buyer2.userId, rating: 4 }).expect(201);
  });

  it('strangers cannot review; ratings are 1-5 integers', async () => {
    await api().post('/v1/reviews').set(bearer(outsider)).send({ listingId, rating: 5 }).expect(403);
    await api().post('/v1/reviews').set(bearer(buyer2)).send({ listingId, rating: 6 }).expect(422);
    await api().post('/v1/reviews').set(bearer(buyer2)).send({ listingId, rating: 2.5 }).expect(422);
    await api().post('/v1/reviews').set(bearer(buyer2)).send({ listingId: '00000000-0000-4000-8000-000000000000', rating: 3 }).expect(404);
  });

  it('GET /reviews/users/:id returns the average', async () => {
    await api().post('/v1/reviews').set(bearer(buyer2)).send({ listingId, rating: 3 }).expect(201);
    const res = await api().get(`/v1/reviews/users/${farmer.userId}`).set(bearer(buyer)).expect(200);
    expect(res.body.data).toMatchObject({ averageRating: 4, count: 2 });
    expect(res.body.data.reviews[0].reviewer).toHaveProperty('name');
    const empty = await api().get(`/v1/reviews/users/${outsider.userId}`).set(bearer(buyer)).expect(200);
    expect(empty.body.data).toMatchObject({ averageRating: 0, count: 0, reviews: [] });
  });
});

describe('realtime (Socket.IO)', () => {
  let server: http.Server;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    server = http.createServer(app);
    realtime.attach(server);
    await new Promise<void>((r) => server.listen(0, r));
    url = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await realtime.close();
    server.close();
  });

  const open = (token?: string) =>
    new Promise<Socket>((resolve, reject) => {
      const s = connect(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
      sockets.push(s);
      s.on('connect', () => resolve(s));
      s.on('connect_error', (e) => reject(e));
    });

  it('rejects connections without a valid token', async () => {
    await expect(open()).rejects.toThrow(/UNAUTHORIZED/);
    await expect(open('garbage')).rejects.toThrow(/UNAUTHORIZED/);
  });

  it('pushes new messages to both people in the conversation, and nobody else', async () => {
    const farmerSocket = await open(farmer.token);
    const buyerSocket = await open(buyer.token);
    const outsiderSocket = await open(outsider.token);

    const got = (s: Socket, event: string) => new Promise<any>((r) => s.once(event, r));
    const fromFarmer = got(farmerSocket, 'message:new');
    const fromBuyer = got(buyerSocket, 'message:new');
    let leaked = false;
    outsiderSocket.on('message:new', () => (leaked = true));

    await api().post(`/v1/conversations/${conversationId}/messages`).set(bearer(buyer)).send({ content: 'Live message' }).expect(201);

    expect((await fromFarmer).content).toBe('Live message');
    expect((await fromBuyer).content).toBe('Live message');
    await new Promise((r) => setTimeout(r, 150));
    expect(leaked).toBe(false);

    const read = got(buyerSocket, 'messages:read');
    await api().patch(`/v1/conversations/${conversationId}/read`).set(bearer(farmer)).expect(200);
    expect(await read).toMatchObject({ conversationId, readerId: farmer.userId });
  });
});
