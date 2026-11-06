import { beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, listingBody, login, setup, type Session } from './helpers.js';
import { config, DEV_ADMIN_PASSWORD } from '../../src/config/index.js';
import { adminService } from '../../src/services/admin.service.js';
import { kv } from '../../src/config/redis.js';

const USERNAME = config.admin.username;
const PASSWORD = DEV_ADMIN_PASSWORD;

let admin: Session;
let farmer: Session;
let buyer: Session;
let listingId: string;

const adminLogin = (username = USERNAME, password = PASSWORD) => api().post('/v1/admin/auth/login').send({ username, password });

beforeAll(async () => {
  await setup();
  const res = await adminLogin().expect(200);
  admin = { phone: res.body.data.user.phone, token: res.body.data.tokens.accessToken, refreshToken: res.body.data.tokens.refreshToken, userId: res.body.data.user.id };

  farmer = await login('0244440001', 'FARMER', 'Kwame Mensah');
  buyer = await login('0504440001', 'BUYER', 'Efua Quaye');
  const l = await api().post('/v1/listings').set(bearer(farmer)).send(listingBody({ produceType: 'Yam' })).expect(201);
  listingId = l.body.data.listing.id;
  await api().post('/v1/conversations').set(bearer(buyer)).send({ listingId, message: 'Hi' }).expect(201);
});

describe('admin account + sign-in', () => {
  it('ensureAdmin is idempotent and the account has the documented development credentials', async () => {
    expect(await adminService.ensureAdmin()).toBe('exists');
    expect(config.admin.usingDevPassword).toBe(true);
    expect(PASSWORD).toBe('AgriMatch@Admin2026');
  });

  it('signs in with username + password and sets httpOnly cookies', async () => {
    const res = await adminLogin().expect(200);
    expect(res.body.data.user).toMatchObject({ role: 'ADMIN', name: 'Administrator' });
    const cookies = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(cookies).toMatch(/accessToken=.*HttpOnly/s);
    expect(cookies).toMatch(/refreshToken=.*HttpOnly.*SameSite=Strict/s);
  });

  it('username is case-insensitive; surrounding spaces are ignored', async () => {
    await adminLogin(`  ${USERNAME.toUpperCase()} `).expect(200);
  });

  it('rejects a wrong password and an unknown user with the same message', async () => {
    const wrong = await adminLogin(USERNAME, 'wrong-password').expect(401);
    const unknown = await adminLogin('nobody', 'wrong-password').expect(401);
    expect(wrong.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Incorrect username or password' });
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('a regular user cannot sign in through the admin form', async () => {
    await adminLogin('anything', 'anything').expect(401);
  });

  it('validates the body', async () => {
    await api().post('/v1/admin/auth/login').send({}).expect(422);
  });

  it('locks the username after 5 failed attempts, even for the right password', async () => {
    await kv.del('admin:fail:' + USERNAME);
    for (let i = 0; i < 4; i++) await adminLogin(USERNAME, 'nope').expect(401);
    const fifth = await adminLogin(USERNAME, 'nope').expect(429);
    expect(fifth.body.error.code).toBe('ADMIN_LOCKED');
    expect(Number(fifth.headers['retry-after'])).toBeGreaterThan(0);

    const right = await adminLogin().expect(429);
    expect(right.body.error.code).toBe('ADMIN_LOCKED');

    await kv.del('admin:lock:' + USERNAME); // let the remaining tests sign in
  });

  it('the admin account cannot be reached through the phone OTP flow', async () => {
    const res = await api().post('/v1/auth/otp/send').send({ phone: '+233000000000' }).expect(400);
    expect(res.body.error.message).toMatch(/Invalid phone/);
  });

  it('a successful sign-in resets the failure counter', async () => {
    await adminLogin(USERNAME, 'nope').expect(401);
    await adminLogin().expect(200);
    expect(await kv.get('admin:fail:' + USERNAME)).toBeNull();
  });
});

describe('authorization', () => {
  const paths = ['/stats', '/users', '/listings', '/me'];

  it('signed-out requests are 401', async () => {
    for (const p of paths) await api().get(`/v1/admin${p}`).expect(401);
  });

  it('farmers and buyers get 403 on every admin endpoint', async () => {
    for (const who of [farmer, buyer]) {
      for (const p of paths) {
        const res = await api().get(`/v1/admin${p}`).set(bearer(who)).expect(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
      await api().patch(`/v1/admin/users/${farmer.userId}`).set(bearer(who)).send({ isActive: false }).expect(403);
      await api().delete(`/v1/admin/listings/${listingId}`).set(bearer(who)).expect(403);
    }
  });

  it('GET /admin/me returns the admin profile', async () => {
    const res = await api().get('/v1/admin/me').set(bearer(admin)).expect(200);
    expect(res.body.data.user).toMatchObject({ role: 'ADMIN', username: USERNAME });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });
});

describe('GET /admin/stats', () => {
  it('summarises users, listings and activity', async () => {
    const { data } = (await api().get('/v1/admin/stats').set(bearer(admin)).expect(200)).body;
    expect(data.users).toMatchObject({ farmers: 1, buyers: 1, admins: 1, total: 3, active: 3, deactivated: 0 });
    expect(data.users.newLast7Days).toBe(3);
    expect(data.listings).toMatchObject({ total: 1, active: 1, sold: 0 });
    expect(data.activity).toMatchObject({ conversations: 1, messages: 1, reviews: 0 });
    expect(data.topProduce).toEqual([{ produce: 'Yam', listings: 1 }]);
    expect(data.signups[0]).toMatchObject({ count: 3 });
  });
});

describe('user management', () => {
  it('lists users with listing counts, search, role and status filters, and pagination', async () => {
    const list = (qs: string) => api().get(`/v1/admin/users${qs}`).set(bearer(admin)).expect(200);

    const all = (await list('')).body.data;
    expect(all.pagination.total).toBe(3);
    const kwame = all.items.find((u: any) => u.id === farmer.userId);
    expect(kwame).toMatchObject({ name: 'Kwame Mensah', role: 'FARMER', listingCount: 1, isActive: true, phone: farmer.phone });
    expect(all.items.every((u: any) => !('passwordHash' in u))).toBe(true);

    expect((await list('?role=BUYER')).body.data.items).toHaveLength(1);
    expect((await list('?search=kwame')).body.data.items.map((u: any) => u.name)).toEqual(['Kwame Mensah']);
    expect((await list('?search=4440001')).body.data.items).toHaveLength(2); // both phones contain it
    expect((await list('?search=%25')).body.data.items).toHaveLength(0); // wildcards are literal
    expect((await list('?limit=1&page=2')).body.data.items).toHaveLength(1);
    await api().get('/v1/admin/users?limit=1000').set(bearer(admin)).expect(422);
  });

  it('deactivating a user signs them out immediately and blocks sign-in', async () => {
    const victim = await login('0244440002', 'BUYER', 'To Deactivate');
    await api().get('/v1/auth/me').set(bearer(victim)).expect(200);

    const res = await api().patch(`/v1/admin/users/${victim.userId}`).set(bearer(admin)).send({ isActive: false }).expect(200);
    expect(res.body.data.user.isActive).toBe(false);

    // the existing access token stops working at once, and so does refresh
    await api().get('/v1/auth/me').set(bearer(victim)).expect(401);
    await api().post('/v1/auth/refresh').send({ refreshToken: victim.refreshToken }).expect(401);

    // signing in again is refused
    await kv.del(`otp:cooldown:${victim.phone}`);
    await api().post('/v1/auth/otp/send').send({ phone: victim.phone }).expect(200);
    const { smsService } = await import('../../src/services/sms.service.js');
    const code = smsService.lastOtpFor(victim.phone);
    const denied = await api().post('/v1/auth/otp/verify').send({ phone: victim.phone, code }).expect(401);
    expect(denied.body.error.code).toBe('ACCOUNT_DISABLED');

    const inactive = (await api().get('/v1/admin/users?status=inactive').set(bearer(admin)).expect(200)).body.data.items;
    expect(inactive.map((u: any) => u.id)).toContain(victim.userId);

    // and can be restored
    await api().patch(`/v1/admin/users/${victim.userId}`).set(bearer(admin)).send({ isActive: true }).expect(200);
  });

  it('changes a regular role, but protects the admin account', async () => {
    const res = await api().patch(`/v1/admin/users/${buyer.userId}`).set(bearer(admin)).send({ role: 'FARMER' }).expect(200);
    expect(res.body.data.user.role).toBe('FARMER');
    await api().patch(`/v1/admin/users/${buyer.userId}`).set(bearer(admin)).send({ role: 'BUYER' }).expect(200);

    const self = await api().patch(`/v1/admin/users/${admin.userId}`).set(bearer(admin)).send({ isActive: false }).expect(403);
    expect(self.body.error.message).toMatch(/own account/);
    await api().patch(`/v1/admin/users/${admin.userId}`).set(bearer(admin)).send({ role: 'BUYER' }).expect(403);

    const promote = await api().patch(`/v1/admin/users/${buyer.userId}`).set(bearer(admin)).send({ role: 'ADMIN' }).expect(409);
    expect(promote.body.error.code).toBe('CONFLICT');
  });

  it('validates and 404s', async () => {
    await api().patch(`/v1/admin/users/${buyer.userId}`).set(bearer(admin)).send({}).expect(422);
    await api().patch('/v1/admin/users/00000000-0000-4000-8000-000000000000').set(bearer(admin)).send({ isActive: false }).expect(404);
    await api().patch('/v1/admin/users/nope').set(bearer(admin)).send({ isActive: false }).expect(422);
  });
});

describe('listing moderation', () => {
  it('lists every listing with its farmer, with filters', async () => {
    const list = (qs: string) => api().get(`/v1/admin/listings${qs}`).set(bearer(admin)).expect(200);
    const all = (await list('')).body.data;
    expect(all.items[0]).toMatchObject({ id: listingId, produceType: 'Yam', status: 'ACTIVE', farmer: { name: 'Kwame Mensah' } });
    expect((await list('?search=kwame')).body.data.items).toHaveLength(1);
    expect((await list('?status=SOLD')).body.data.items).toHaveLength(0);
  });

  it('deactivates a listing, which then disappears from the marketplace', async () => {
    await api().patch(`/v1/admin/listings/${listingId}`).set(bearer(admin)).send({ status: 'DEACTIVATED' }).expect(200);
    const browse = await api().get('/v1/listings?produce=Yam').set(bearer(buyer)).expect(200);
    expect(browse.body.data.items).toHaveLength(0);
    await api().patch(`/v1/admin/listings/${listingId}`).set(bearer(admin)).send({ status: 'ACTIVE' }).expect(200);
    await api().patch(`/v1/admin/listings/${listingId}`).set(bearer(admin)).send({ status: 'BOGUS' }).expect(422);
    await api().patch('/v1/admin/listings/00000000-0000-4000-8000-000000000000').set(bearer(admin)).send({ status: 'SOLD' }).expect(404);
  });

  it('deletes a listing', async () => {
    const extra = await api().post('/v1/listings').set(bearer(farmer)).send(listingBody({ produceType: 'Okra' })).expect(201);
    await api().delete(`/v1/admin/listings/${extra.body.data.listing.id}`).set(bearer(admin)).expect(200);
    await api().get(`/v1/listings/${extra.body.data.listing.id}`).set(bearer(buyer)).expect(404);
    await api().delete(`/v1/admin/listings/${extra.body.data.listing.id}`).set(bearer(admin)).expect(404);
  });
});

describe('POST /admin/password', () => {
  it('enforces strength, checks the current password, and signs out other sessions', async () => {
    const pw = (body: object, who = admin) => api().post('/v1/admin/password').set(bearer(who)).send(body);

    await pw({ currentPassword: PASSWORD, newPassword: 'short' }).expect(422);
    await pw({ currentPassword: PASSWORD, newPassword: 'alllowercaseletters1' }).expect(422);
    const wrong = await pw({ currentPassword: 'nope', newPassword: 'NewPassw0rd!Longer' }).expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    await pw({ currentPassword: PASSWORD, newPassword: PASSWORD }).expect(400);

    const other = await adminLogin().expect(200); // a second session
    const NEW = 'NewPassw0rd!Longer';
    const ok = await pw({ currentPassword: PASSWORD, newPassword: NEW }).expect(200);
    expect(ok.body.data.tokens.accessToken).toBeTruthy();

    // old password no longer works, new one does; the other session's refresh token is revoked
    await adminLogin(USERNAME, PASSWORD).expect(401);
    await api().post('/v1/auth/refresh').send({ refreshToken: other.body.data.tokens.refreshToken }).expect(401);
    const back = await adminLogin(USERNAME, NEW).expect(200);

    // restore for any later test
    await api().post('/v1/admin/password').set('Authorization', `Bearer ${back.body.data.tokens.accessToken}`)
      .send({ currentPassword: NEW, newPassword: PASSWORD + 'x' }).expect(200);
    await adminLogin(USERNAME, PASSWORD + 'x').expect(200);
  });
});
