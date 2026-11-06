# AgriMatch API

Express 5 + TypeScript + Drizzle ORM + Postgres, built from `project-documentation.md` (sections 5-8, 10-12).
Runs with **no accounts or external services**: embedded Postgres, an in-process key-value store, and OTPs printed to the log.

## Run it

```bash
cd apps/api
npm install
npm run db:seed     # optional: Ghana sample data (stop the API first; see "One process at a time")
npm run dev         # http://localhost:4000/v1  (migrations run automatically on start)
npm test            # 132 tests, in-memory database
npm run typecheck
```

Sign in as a seeded user: farmer `024 123 4567`, buyer `050 123 4567`. Send an OTP, then read the 6-digit code from the
server log (`SMS to +233...: Your AgriMatch code is 123456`).

```bash
curl -X POST localhost:4000/v1/auth/otp/send   -H 'content-type: application/json' -d '{"phone":"0501234567"}'
curl -X POST localhost:4000/v1/auth/otp/verify -H 'content-type: application/json' -d '{"phone":"0501234567","code":"123456"}'
# then: -H "authorization: Bearer <accessToken>"   (or use the httpOnly accessToken cookie the verify call sets)
```

## Admin dashboard credentials

The admin account is created automatically the first time the API starts (and by `npm run db:seed`).

| | Development | Production |
|---|---|---|
| Username | `admin` (override with `ADMIN_USERNAME`) | `ADMIN_USERNAME` |
| Password | `AgriMatch@Admin2026` | `ADMIN_PASSWORD` (required, 12+ characters). Without it **no admin account is created** |

Sign in at `/admin/login` in the web app (or `POST /v1/admin/auth/login`). **Change the password after your first sign-in**
(Admin, then the Account tab, or `POST /v1/admin/password`).
The default password only exists in development and is never used when `NODE_ENV=production`.
Once the account exists, changing `ADMIN_PASSWORD` in the environment does not overwrite it; use the Account tab.

Security: sign-in is limited to 10 attempts a minute per IP and locks a username for 15 minutes after 5 wrong passwords;
passwords are bcrypt-hashed; the admin account has no usable phone number, so it cannot be reached through the OTP flow;
admins cannot deactivate or demote themselves, and cannot promote other accounts to admin.

## Endpoints (`/v1`)

Public: `GET /health`, `POST /auth/otp/send`, `POST /auth/otp/verify`, `POST /auth/refresh`, `POST /auth/logout`.
Everything else needs an access token (Bearer header or `accessToken` cookie).

| Area | Endpoints |
|------|-----------|
| Auth | `GET /auth/me`, `PATCH /auth/me` (name, role FARMER/BUYER, location) |
| Listings | `POST /listings` (farmer), `GET /listings` (filters + pagination), `GET /listings/my`, `GET /listings/:id`, `PATCH /listings/:id`, `DELETE /listings/:id`, `POST /listings/:id/images` (field `images`, max 5, 5MB each), `DELETE /listings/:id/images/:imgId` |
| Matching | `POST /match` (weighted multi-criteria scoring, doc section 7) |
| Analytics | `GET /analytics/summary`, `/prices`, `/prices/:produce?months=6`, `/locations` |
| Messaging | `POST /conversations`, `GET /conversations`, `GET /conversations/:id/messages`, `POST /conversations/:id/messages`, `PATCH /conversations/:id/read` |
| Reviews | `POST /reviews`, `GET /reviews/users/:userId` |
| Admin (ADMIN role only) | `POST /admin/auth/login` (public), `GET /admin/me`, `POST /admin/password`, `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/users/:id` (deactivate, role), `GET /admin/listings`, `PATCH /admin/listings/:id` (status), `DELETE /admin/listings/:id` |

Realtime: Socket.IO on the same port. Connect with `auth: { token: <accessToken> }` (or the cookie); you receive
`message:new` and `messages:read` for conversations you are in.

Responses are `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`.

## Stand-ins for services that need accounts

| Doc says | This build | Switch to the real one |
|----------|-----------|------------------------|
| Neon Postgres | PGlite (embedded Postgres) in `./.data/pglite` | set `DATABASE_URL` to a Neon string |
| Upstash Redis | in-process store (TTL, INCR, EXPIRE) | set `UPSTASH_REDIS_REST_URL` and `_TOKEN` |
| Africa's Talking SMS | OTP written to the server log (`services/sms.service.ts`) | replace `deliver()` |
| Cloudinary | sharp-processed WebP on local disk, served at `/uploads` | replace `services/image.service.ts` |

The Neon and Upstash paths are written to the docs but have **not been run** (no accounts were available to test them).
The in-process store is per instance, so use Upstash if you run more than one server.

## Where this differs from the documentation

- Ghana: phone numbers are Ghana mobile numbers (`+233`, 9 digits starting 2 or 5), default currency `GHS`, and `utils/ghana.ts` holds the town table used to resolve a location name to coordinates.
- Every endpoint except the public ones requires authentication (the doc's middleware pipeline), so listing browse and matching are for signed-in users.
- Refresh tokens are stored as SHA-256 hashes, and replaying a used refresh token revokes that user's sessions.
- `authenticate` reads the role from the database, so a role change or deactivation applies immediately.
- Matching does not pre-filter produce in SQL (the doc's `ILIKE` made the fuzzy 0.3 tier unreachable); the produce score decides.
- Added from the functional requirements but not in the endpoint list: reviews (FR-13), price-distribution and recent listings in `/analytics/summary`, monthly history for `/analytics/prices/:produce`.
- `bcryptjs` (pure JS) instead of `bcrypt`, to avoid a native build step.
- Conversations and reviews cascade when their listing is deleted.

## One process at a time

PGlite is a single-process database: stop the API before `npm run db:seed`, and do not run two API instances on the same `DATA_DIR`.
Use a Neon `DATABASE_URL` for anything multi-process.

## Layout

```
src/config      env, logger, key-value store
src/db          schema, client (Neon | PGlite), migrations runner, seed
src/routes      route table          src/middleware  authenticate, validate, rateLimit, upload, errors
src/controllers thin HTTP layer      src/services    auth, listing, matching, analytics, messaging, review, sms, image
src/repositories Drizzle queries     src/validations Zod schemas          src/websocket  Socket.IO hub
drizzle/        generated SQL migrations (npm run db:generate after changing src/db/schema.ts)
tests/          unit + integration (supertest)
```
