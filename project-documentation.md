# AgriMatch - Full Stack Project Documentation

key things to know
1. Use real images and an icon library
2. For any tool that requires account creation, like (Africa's talking, redis, and the rest), skip that and find a way around it. For instance, log the OTP in the console 

# AgriMatch - Full Stack Project Documentation (Svelte + Drizzle + Postgres)

## Agricultural Produce Market Information & Matching System

> **Last updated: 2026-11-06.** Section 0 describes what is actually built and what is left. Sections 1-16 are the original
> design; each one that differs from the build has an **As built** note at its top. Where they disagree, section 0 and the
> "As built" notes win.

---

## Table of Contents

0. [Project Status (as built, and what is left)](#0-project-status)
1. [Executive Summary](#1-executive-summary)
2. [System Requirements](#2-system-requirements)
3. [Architecture Overview](#3-architecture-overview)
4. [Technology Stack](#4-technology-stack)
5. [Database Design (Drizzle + Neon)](#5-database-design)
6. [API Specification](#6-api-specification)
7. [Matching Algorithm](#7-matching-algorithm)
8. [Authentication Flow (Phone OTP)](#8-authentication-flow)
9. [Frontend Architecture (SvelteKit)](#9-frontend-architecture)
10. [Backend Architecture](#10-backend-architecture)
11. [Project Structure](#11-project-structure)
12. [Implementation Guide](#12-implementation-guide)
13. [Styling System (Vanilla CSS)](#13-styling-system)
14. [Deployment](#14-deployment)
15. [Testing Strategy](#15-testing-strategy)
16. [Security Considerations](#16-security-considerations)

---

## 0. Project Status

### 0.1 In one paragraph

AgriMatch is a working Ghana-focused marketplace: farmers list produce, buyers browse a marketplace, run weighted smart matching,
read market prices and insights, and message sellers in real time; an admin dashboard manages users and listings. It runs
end to end on a laptop with **no accounts or external services** (embedded Postgres, in-process key-value store, OTP written to
the server log, images on local disk). It has **not been deployed**, the Neon, Upstash and real-SMS code paths have **never been
run**, and there are no browser (E2E) tests or CI yet.

### 0.2 What the build is (vs the original design)

| Area | Original design | As built |
|------|-----------------|----------|
| Frontend framework | SvelteKit 2 + Svelte 5 runes, SSR | **Vite + Svelte 4 single-page app** with `svelte-navigator`. No SSR, no Superforms, no `+page.server.ts`. Leftover `svelte.config.js`, `src/app.html`, empty `src/routes/` and unused devDependencies (`@sveltejs/kit`, Tailwind, PostCSS) can be removed |
| Frontend location | `apps/web` | **`frontend/`** (dev server on port 5173, proxies `/v1`, `/uploads`, `/socket.io` to the API) |
| Styling | Vanilla CSS split over 8 files | Vanilla CSS, **tokens in `frontend/src/styles/theme.css`** plus scoped component styles. Fonts: Anton (display) and one text family. **Light theme only** (no dark mode) |
| Icons / charts / maps | Lucide, Chart.js, Leaflet | Lucide (`lucide-svelte`) everywhere. Chart.js is used only by the admin overview; the Prices page uses hand-built SVG/CSS (heat-map grid, bars, gauge). **Leaflet is installed but unused** (no map yet) |
| API | Express 5 + TS + Drizzle in `apps/api` | As designed. Layers: routes, middleware, controllers, services, repositories. `src/index.ts` is the entry (`server.ts` only exports a start function) |
| Database | Neon Postgres | **PGlite (embedded Postgres)** in `apps/api/.data/pglite` when `DATABASE_URL` is empty; Neon driver used when it is set (**untested**). Migrations run automatically at start. Single process only: a `pglite.lock` file stops two servers sharing the folder |
| Key-value (OTP, cooldowns, rate limits) | Upstash Redis | **In-process store** with the same semantics; Upstash client is used when both env vars are set (**untested**). Per instance only |
| SMS OTP | Africa's Talking | **OTP is written to the server log** (`SMS to +233...: Your AgriMatch code is 123456`). `services/sms.service.ts` has one `deliver()` to replace |
| Image storage | Cloudinary | **sharp re-encodes to WebP (max 1600px, EXIF stripped) on local disk**, served at `/uploads`. Isolated in `services/image.service.ts` |
| Auth | Phone + OTP, bcrypt (native) | Phone + OTP with `bcryptjs`; Ghana numbers only (`+233`); JWT access (15 min) and refresh (7 days) tokens as httpOnly cookies or Bearer header; refresh tokens stored as SHA-256 hashes and replay revokes the session. **Admin** signs in separately with username and password at `/admin/login` (rate limited, locked after 5 failures) |
| Currency / region | KES, Kenya | **GHS, Ghana**; `utils/ghana.ts` resolves town names to coordinates |
| Monorepo tooling | Turborepo, `packages/shared` | **Not used.** Two independent npm projects (`apps/api`, `frontend`); no shared package |
| Docker | None | None |

### 0.3 Run it locally

```bash
# API  (http://localhost:4000/v1)
cd apps/api && npm install
npm run db:seed        # optional Ghana sample data (stop the API first)
npm run dev            # migrations run on start
npm test               # 147 tests, in-memory database
npm run typecheck

# Web  (http://localhost:5173)
cd frontend && npm install && npm run dev
```

Seeded sign-ins: farmer `024 123 4567`, buyer `050 123 4567`. Request a code, then read the 6 digits from the API console.
Admin: `/admin/login`, username `admin`, development password `AgriMatch@Admin2026` (change it in Admin, then Account;
in production `ADMIN_PASSWORD` of 12+ characters is required or no admin is created).
If the API crashes at start with `Aborted()`, the PGlite folder was damaged: move `apps/api/.data` aside, restart, run `npm run db:seed` (see `apps/api/README.md`).

### 0.4 Screens and routes (all built)

| Route | Who | What it does |
|-------|-----|--------------|
| `/` | public | Landing page |
| `/login`, `/verify`, `/onboarding` | public / new users | Phone number, 6-digit code, then name and role (Farmer or Buyer) |
| `/dashboard` | signed in | Role-aware summary |
| `/marketplace` | signed in | Product catalog with search, filters, sort, saved items, "Viewed" badges, share link. Clicking a product opens a **side panel** (`?listing=<id>`, back button closes it, focus trap, Esc); contact opens a message dialog |
| `/search` | buyer | Smart match: produce, quantity, budget, location, date, organic and adjustable weights; ranked results with a score breakdown |
| `/market` | signed in | **Prices**: bento dashboard with price heat map, price trend (3/6/12 months), market balance gauge, posted-today, CSV download and print, sortable price table, distribution and towns tiles, and an **Insights** section |
| `/listings`, `/listings/new`, `/listings/:id/edit` | farmer | My listings (mark sold, deactivate, delete), create and edit with up to 5 photos |
| `/listings/:id` | signed in | Full listing page (the marketplace uses the panel instead) |
| `/messages`, `/messages/:conversationId` | signed in | Conversations, live chat over Socket.IO, unread badge in the header, rate a seller |
| `/profile` | signed in | Edit name, role, location; seller rating |
| `/admin/login`, `/admin` | admin | Overview charts, users (deactivate, change role), listings (change status, delete), account (change password) |
| `/credits` | public | Image and icon credits |

Shared: `SiteHeader` / `SiteFooter` / `Brand` (real logo `frontend/public/logo.png`, plus generated favicon and app icons).

### 0.5 Requirements checklist

**Functional**

| ID | Requirement | Status |
|----|-------------|--------|
| FR-01 | Phone + OTP sign-in | Done (OTP shown in server log, not sent by SMS) |
| FR-02 | Choose Farmer or Buyer | Done (onboarding and profile) |
| FR-03 | Create listings (type, category, quantity, unit, price, location + coordinates, dates, organic, up to 5 photos, description) | Done. Location is a Ghana town list, not a map picker |
| FR-04 | Edit, deactivate, delete listings | Done (also mark as sold) |
| FR-05 | Search by produce | Done (marketplace and smart match) |
| FR-06 | Filter by quantity, price, location, date, organic | Done |
| FR-07 | Weighted ranking (Haversine, Levenshtein) | Done, 29 unit tests |
| FR-08 | Adjust weights | Done (sliders, normalised to 100%) |
| FR-09 | Score breakdown per listing | Done |
| FR-10 | Contact sellers | Done as in-app messaging. **Phone number reveal is not built** |
| FR-11 | Market analytics | Done, beyond the original: insights engine, price map, trend, balance, CSV and print |
| FR-12 | Notifications | **Partial.** Live new-message events and an unread badge only. No "new match for your search" alerts, no notification centre, no email or SMS |
| FR-13 | Rate completed transactions | Done as one review per buyer per listing. It is not tied to a "completed" order, because there is no order flow |

**Non-functional (measured or not)**

| ID | Target | Status |
|----|--------|--------|
| NFR-01..03 | TTFB, LCP, initial JS < 50 KB | **Not applicable / not met.** It is an SPA, so there is no SSR; the bundle has not been measured or trimmed |
| NFR-05, 06 | 10,000 concurrent users, 99.9% uptime | **Not tested.** The in-process key-value store and PGlite are single instance by design |
| NFR-07 | Works without JavaScript | **Not met** (SPA) |
| NFR-08 | OTP within 5 s | **Not testable** until a real SMS provider exists |
| NFR-09 | Uploads < 5 MB | Done (enforced, 5 files of 5 MB) |
| NFR-10 | Search under 500 ms | Fine on the seed data; **not load-tested** |

### 0.6 API surface (all under `/v1`, responses `{ success, data }` or `{ success:false, error }`)

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/otp/send`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout`; `GET`/`PATCH /auth/me` |
| Listings | `POST /listings`; `GET /listings` (filters, pagination, `sort=newest\|price_asc\|price_desc`); `GET /listings/my`; `GET`/`PATCH`/`DELETE /listings/:id`; `POST /listings/:id/images`; `DELETE /listings/:id/images/:imgId` |
| Matching | `POST /match` |
| Analytics | `GET /analytics/summary`, `/prices`, `/prices/:produce?months=`, `/locations`, **`/insights`** (pulse, balance, price map, insight cards) |
| Messaging | `POST`/`GET /conversations`; `GET`/`POST /conversations/:id/messages`; `PATCH /conversations/:id/read`; Socket.IO events `message:new`, `messages:read` |
| Reviews | `POST /reviews`; `GET /reviews/users/:userId` |
| Admin | `POST /admin/auth/login`; `GET /admin/me`, `/stats`, `/users`, `/listings`; `POST /admin/password`; `PATCH /admin/users/:id`, `/admin/listings/:id`; `DELETE /admin/listings/:id` |

Every endpoint except health and the sign-in calls needs authentication, so browsing and matching are for signed-in users only.

### 0.7 Insights engine (new, not in the original design)

`apps/api/src/services/insights.ts` holds pure functions (no database) so they are easy to test. Produce is only compared within the same
unit (tomatoes per kg are never mixed with tomatoes per crate). Rules: town and spread insights need 3 or more listings; a price "move"
needs 5% or more; the cheapest-town insight needs a 10% gap; a wide spread is high at least 1.5x low. Insight types: biggest price move
since last month, cheapest town, new listings this week, organic premium, widest spread, most-listed produce. Farmers also get a
"Your listing" card comparing their own prices with the market (15% or more, 2 or more market listings).
Covered by 13 unit tests and an integration test.

### 0.8 Testing and quality (current)

| Check | Result |
|-------|--------|
| API tests (vitest + supertest, in-memory database) | **147 passing**: matching 29, insights 13, phone 3, plus integration for auth, listings, match and analytics, messaging, admin, rate limits |
| `tsc --noEmit` (API) | Clean |
| `vite build` (frontend) | Clean |
| Browser checks (headless Chrome scripts, kept outside the repo) | Marketplace, side panel, logo and admin: 58 checks; Prices page: 23 checks; both at 1280 px and 390 px. **Not committed as an automated suite** |
| Frontend unit tests, Playwright, CI | **None** |

### 0.9 What is left

**A. Needed before real users (blocking)**

1. **Real SMS delivery.** Replace `deliver()` in `services/sms.service.ts` with Africa's Talking (or Twilio / Hubtel) and add a provider env section; keep the console fallback for development.
2. **Run and fix the production data path.** Create a Neon database, set `DATABASE_URL`, run `npm run db:migrate`, and exercise every endpoint. Same for **Upstash Redis** (required once more than one server instance runs). Both paths are written but never executed.
3. **Production image storage.** Local disk does not survive most hosts. Move `image.service.ts` to Cloudinary or S3 and serve images from a CDN.
4. **Deploy.** Choose hosts (the plan: static frontend on Vercel, API on Railway or Fly), set CORS origin, cookie `Secure` and `SameSite` for the real domain, JWT secrets and `ADMIN_PASSWORD`, add the HTTPS domain to the doc's API base URL (section 6.1 still says `agrimatch.co.ke`).
5. **CI.** Add GitHub Actions: install, typecheck, `npm test`, `vite build` for both projects.
6. **Browser tests.** Turn the throwaway headless-Chrome scripts into a committed Playwright suite (login by OTP, marketplace panel, post a listing, match, message, admin).

**B. Feature gaps against the requirements**

7. **FR-10:** reveal the seller's phone number (with an audit or rate limit) and a "call / WhatsApp" action.
8. **FR-12:** notifications centre; "new listing matches your saved search" alerts; "Save search" (the reference design had it, it is not built); optional SMS or email digests.
9. **Saved listings and "Viewed"** are stored per device in `localStorage`. Move them to the database (a `saved_listings` table and endpoints) so they follow the user.
10. **Orders / completed deals.** FR-13 says ratings follow a completed transaction, but there is no order or "deal confirmed" step. Add a simple state (buyer and seller both confirm) and require it before a review.
11. **Listing expiry job.** `EXPIRED` status exists but nothing sets it when `availableTo` passes. Add a scheduled job or compute on read.
12. **Map view.** Leaflet is installed but unused: add a map on the marketplace and a location picker on the listing form (FR-03 mentions GPS coordinates).
13. **Password-less account recovery / phone change** and **account deletion** are not built.

**C. Quality, performance and scale**

14. **Insights are computed in memory** over all active listings on each request. Fine now; move to SQL aggregates and cache in the key-value store before listings reach the tens of thousands.
15. **Unfinished UI standards:** no dark mode (light only), no measured Lighthouse or bundle-size results, and no formal accessibility audit (contrast and keyboard focus were checked by hand on the pages built recently, not on every page). The skeleton, empty and error states exist on the main pages but have not been audited on all.
16. **Internationalisation.** English only; consider Twi, Ga, Dagbani and Hausa labels given the audience, and an offline-tolerant PWA (no manifest or service worker yet).
17. **Load testing** against the NFR targets, and database indexes reviewed against real query plans.
18. **Cleanup:** remove the unused SvelteKit leftovers and dependencies in `frontend/`, update `apps/api/README.md` test count (it says 132, now 147) and endpoint table (add `/analytics/insights` and `sort`), and decide whether to adopt a shared types package.
19. **Process hygiene:** the PGlite folder corrupts if a server is hard-killed or two run at once. Use one server at a time locally; production on Neon does not have this limit.

**D. Documentation**

20. Sections 4, 5.3, 9, 11-14 and 15 below still describe the original SvelteKit/Neon design in detail. They are kept as reference; their **As built** notes say what differs. If the project stays an SPA, rewrite them rather than keeping both.

---

## 1. Executive Summary

### 1.1 Problem Statement

Small-scale farmers face uncertainty about where to sell their produce and at what prices. Buyers struggle to find farmers who have the required quantity and type of produce. No centralized, intelligent platform connects these parties.

### 1.2 Solution

**AgriMatch** is a full-stack web application that:

- Enables farmers to list produce with quantity, price, location, and availability
- Enables buyers to search, filter, compare, and contact sellers
- Implements a **weighted multi-criteria matching algorithm** ranking results by produce type, quantity, location proximity (Haversine), price, and availability
- Uses **phone number + OTP** authentication for accessibility in agricultural communities
- Provides real-time market price analytics and trends

### 1.3 Key Technology Decisions

| Decision | Rationale |
|----------|-----------|
| **SvelteKit** | SSR for fast loads on slow rural connections; small bundles |
| **Drizzle ORM** | Lightweight, type-safe, SQL-first, edge-compatible |
| **Neon Postgres** | Serverless Postgres, auto-scaling, generous free tier, branching |
| **Vanilla CSS** | Zero runtime cost, full control, no build-step dependencies, native CSS features |
| **Phone + OTP** | No email needed — accessible to rural farmers |
| **No Docker** | Direct deployment to Vercel/Node; Neon handles DB; simpler ops |

### 1.4 Advantages of This Stack

| Feature | Benefit |
|---------|---------|
| **Neon Serverless** | Zero infrastructure management; auto-pause when idle; HTTP + WebSocket drivers |
| **Drizzle ORM** | SQL-first API, TypeScript-native, zero runtime overhead, works on edge |
| **Vanilla CSS** | No Tailwind JIT compiler; smaller bundle; CSS variables for theming; modern features (nesting, `@layer`, `color-mix()`) |
| **SvelteKit SSR** | Fast initial paint; works on 2G/3G; progressive enhancement |
| **No Docker** | Faster onboarding; direct `npm run dev`; deploy to Vercel/Railway/Fly |

---

## 2. System Requirements

### 2.1 Functional Requirements

```
FR-01: Users shall register/login using phone number + OTP
FR-02: Users shall select role (Farmer/Buyer) during onboarding
FR-03: Farmers shall create produce listings with:
        - Produce type, category
        - Quantity and unit
        - Price per unit
        - Location (name + GPS coordinates)
        - Availability date range
        - Organic certification flag
        - Photos (up to 5)
        - Description
FR-04: Farmers shall edit, deactivate, and delete their listings
FR-05: Buyers shall search produce by type
FR-06: Buyers shall filter by quantity, price, location, date, organic
FR-07: System shall rank matches using weighted multi-criteria algorithm
FR-08: Buyers shall adjust matching weights (priorities)
FR-09: Buyers shall view match score breakdown per listing
FR-10: Buyers shall contact sellers (reveal phone, in-app message)
FR-11: System shall display market analytics (avg prices, trends)
FR-12: Users shall receive notifications (new matches, messages)
FR-13: Users shall rate completed transactions
```

### 2.2 Non-Functional Requirements

```
NFR-01: Time to First Byte < 100ms (SSR)
NFR-02: Largest Contentful Paint < 1.5s
NFR-03: JavaScript bundle < 50KB (initial route)
NFR-04: CSS bundle < 20KB (gzipped)
NFR-05: Support 10,000+ concurrent users
NFR-06: 99.9% uptime SLA
NFR-07: Progressive enhancement — core flows work without JS
NFR-08: OTP delivery within 5 seconds
NFR-09: Image uploads < 5MB per file
NFR-10: Search results within 500ms
```

---

## 3. Architecture Overview

### 3.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │          SvelteKit Application (SSR + Client)              │  │
│  │                                                            │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │  │
│  │  │  Auth    │ │  Farmer  │ │  Buyer   │ │  Market      │ │  │
│  │  │  Pages   │ │  Pages   │ │  Pages   │ │  Analytics   │ │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘ │  │
│  │       │             │            │              │          │  │
│  │  ┌────┴─────────────┴────────────┴──────────────┴───────┐ │  │
│  │  │  SvelteKit Load Functions + Form Actions              │ │  │
│  │  │  Svelte 5 Runes + Vanilla CSS                         │ │  │
│  │  └──────────────────────┬────────────────────────────────┘ │  │
│  └─────────────────────────┼──────────────────────────────────┘  │
├────────────────────────────┼─────────────────────────────────────┤
│                     API GATEWAY / REVERSE PROXY                  │
│              Rate Limiting · SSL Termination · CORS              │
├────────────────────────────┼─────────────────────────────────────┤
│                        SERVER LAYER                              │
│                                                                  │
│  ┌─────────────────────────┼──────────────────────────────────┐  │
│  │              Node.js + Express (TypeScript)                │  │
│  │                         │                                  │  │
│  │  ┌──────────┐ ┌────────┴───────┐ ┌─────────────────────┐ │  │
│  │  │  Auth    │ │   REST API     │ │   WebSocket Server  │ │  │
│  │  │  Service │ │   Controllers  │ │   (Socket.IO)       │ │  │
│  │  │  (OTP)  │ │   + Middleware  │ │   Real-time notif.  │ │  │
│  │  └────┬─────┘ └────────┬───────┘ └──────────┬──────────┘ │  │
│  │       │                │                     │            │  │
│  │  ┌────┴────────────────┴─────────────────────┴──────────┐ │  │
│  │  │                Service Layer                          │ │  │
│  │  │  ┌────────────┐ ┌──────────────┐ ┌────────────────┐  │ │  │
│  │  │  │ Listing    │ │  Matching    │ │  Analytics     │  │ │  │
│  │  │  │ Service    │ │  Engine      │ │  Service       │  │ │  │
│  │  │  └────────────┘ └──────────────┘ └────────────────┘  │ │  │
│  │  └──────────────────────┬────────────────────────────────┘ │  │
│  │                         │                                  │  │
│  │  ┌──────────────────────┴────────────────────────────────┐ │  │
│  │  │         Data Access Layer (Drizzle ORM)                │ │  │
│  │  │         @neondatabase/serverless driver                │ │  │
│  │  └──────────────────────┬────────────────────────────────┘ │  │
│  └─────────────────────────┼──────────────────────────────────┘  │
├────────────────────────────┼─────────────────────────────────────┤
│                        DATA LAYER                                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Neon        │  │  Upstash     │  │  Cloudinary            │ │
│  │  Postgres    │  │  Redis       │  │  (Image Storage)       │ │
│  │  (Serverless)│  │  (Serverless)│  │                        │ │
│  │              │  │  OTP + Cache │  │                        │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              External Services                               ││
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  ││
│  │  │ Africa's    │  │  Twilio /    │  │  Google Maps       │  ││
│  │  │ Talking     │  │  MessageBird │  │  Geocoding API     │  ││
│  │  │ (SMS OTP)   │  │  (Fallback)  │  │                    │  ││
│  │  └─────────────┘  └──────────────┘  └────────────────────┘  ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Why Neon + Drizzle?

```
┌─────────────────────────────────────────────────────────────────┐
│               Neon Serverless Postgres                           │
├─────────────────────────────────────────────────────────────────┤
│ ✅ Serverless — scales to zero, pay for what you use            │
│ ✅ HTTP driver — works in edge/serverless environments          │
│ ✅ WebSocket driver — persistent connections for Node servers   │
│ ✅ Database branching — instant copies for dev/preview          │
│ ✅ Point-in-time recovery                                        │
│ ✅ Built-in connection pooling (PgBouncer)                       │
│ ✅ Auto-scaling compute                                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Drizzle ORM                                  │
├─────────────────────────────────────────────────────────────────┤
│ ✅ SQL-first — queries read like SQL                            │
│ ✅ Type-safe — full TypeScript inference                         │
│ ✅ Zero runtime overhead — no query engine, compiles to SQL     │
│ ✅ Edge-compatible — works in Vercel/Cloudflare Workers         │
│ ✅ Drizzle Kit — migrations from schema                         │
│ ✅ Drizzle Studio — visual DB browser                            │
│ ✅ Lightweight — ~7KB gzipped                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Technology Stack

> **As built:** the frontend is Vite + Svelte 4 (not SvelteKit/Svelte 5) with `svelte-navigator`, `lucide-svelte`, `chart.js`, `socket.io-client`; no Superforms, no TypeScript in components. The API uses `bcryptjs`, `PGlite`, `@neondatabase/serverless`, `@upstash/redis`, `multer`, `sharp`, `socket.io`, `winston`, `helmet`, `zod`, `vitest` + `supertest`. Not used: Turborepo, Playwright, Africa's Talking, Cloudinary, Leaflet (installed only). See section 0.2.

### 4.1 Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **SvelteKit** | 2.x | Full-stack Svelte framework (SSR + SPA) |
| **Svelte** | 5.x | UI framework (with Runes: $state, $derived, $effect) |
| **TypeScript** | 5.x | Type safety |
| **Vite** | 6.x | Build tool (built into SvelteKit) |
| **Vanilla CSS** | native | Styling (CSS variables, nesting, `@layer`, `color-mix()`) |
| **Superforms** | 2.x | Type-safe form handling with validation |
| **Zod** | 3.x | Schema validation (shared with backend) |
| **Lucide Svelte** | latest | Icon library (SVG, tree-shakeable) |
| **Chart.js** | 4.x | Data visualization (lightweight) |
| **Leaflet** | 1.x | Maps |
| **Socket.IO Client** | 4.x | Real-time messaging |

### 4.2 Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 22.x LTS | Runtime |
| **Express** | 5.x | HTTP framework |
| **TypeScript** | 5.x | Type safety |
| **Drizzle ORM** | 0.36+ | SQL-first type-safe ORM |
| **Drizzle Kit** | 0.28+ | Migrations & schema management |
| **@neondatabase/serverless** | 0.10+ | Neon Postgres driver |
| **Neon Postgres** | 17 | Serverless database |
| **Upstash Redis** | — | Serverless Redis (OTP, cache, rate limit) |
| **Socket.IO** | 4.x | Real-time communication |
| **Zod** | 3.x | Request validation |
| **Helmet** | 8.x | Security headers |
| **Winston** | 3.x | Application logging |
| **Sharp** | 0.33.x | Image processing |
| **jsonwebtoken** | 9.x | JWT tokens |
| **bcrypt** | 5.x | OTP hashing |
| **Africa's Talking** | latest | SMS OTP delivery |

### 4.3 DevOps & Tools

| Tool | Purpose |
|------|---------|
| **GitHub Actions** | CI/CD |
| **ESLint** + **Prettier** | Code quality |
| **Vitest** | Unit testing |
| **Playwright** | E2E testing (built into SvelteKit) |
| **Vercel / Railway / Fly.io** | Deployment |
| **Turborepo** | Monorepo task orchestration |
| **Drizzle Studio** | DB GUI (`drizzle-kit studio`) |

---

## 5. Database Design (Drizzle + Neon)

### 5.1 Entity Relationship Diagram

```
┌────────────────────┐       ┌─────────────────────────┐
│       users        │       │     produce_listings     │
├────────────────────┤       ├─────────────────────────┤
│ id (UUID) PK       │──┐    │ id (UUID) PK            │
│ phone (VARCHAR)    │  │    │ farmer_id (UUID) FK ─────┤──┐
│ phone_verified     │  │    │ produce_type (VARCHAR)   │  │
│ name (VARCHAR)     │  │    │ category (ENUM)          │  │
│ role (ENUM)        │  │    │ quantity (NUMERIC)       │  │
│ avatar_url         │  │    │ unit (ENUM)              │  │
│ location (VARCHAR) │  │    │ price_per_unit (NUMERIC) │  │
│ latitude (NUMERIC) │  │    │ currency (VARCHAR)       │  │
│ longitude (NUMERIC)│  │    │ location (VARCHAR)       │  │
│ created_at         │  │    │ latitude (NUMERIC)       │  │
│ updated_at         │  │    │ longitude (NUMERIC)      │  │
│ last_login_at      │  │    │ available_from (DATE)    │  │
│ is_active          │  │    │ available_to (DATE)      │  │
└────────┬───────────┘  │    │ is_organic (BOOLEAN)      │  │
         │              │    │ description (TEXT)        │  │
         │              │    │ status (ENUM)             │  │
         │              │    │ view_count (INT)          │  │
         │              │    │ created_at               │  │
         │              │    │ updated_at               │  │
         │              │    └──────────┬──────────────┘  │
         │              │               │                 │
         │              │    ┌──────────┴──────────────┐  │
         │              │    │    listing_images        │  │
         │              │    ├─────────────────────────┤  │
         │              │    │ id (UUID) PK            │  │
         │              │    │ listing_id (UUID) FK    │  │
         │              │    │ url (VARCHAR)           │  │
         │              │    │ is_primary (BOOLEAN)    │  │
         │              │    │ sort_order (INTEGER)    │  │
         │              │    └─────────────────────────┘  │
         │              │                                 │
         │    ┌─────────┴───────────────┐                 │
         │    │     conversations       │                 │
         │    ├─────────────────────────┤                 │
         ├────│ buyer_id (UUID) FK      │                 │
         │    │ listing_id (UUID) FK ───┤─────────────────┘
         │    │ created_at              │
         │    └──────────┬──────────────┘
         │               │
         │    ┌──────────┴──────────────┐
         │    │       messages          │
         │    ├─────────────────────────┤
         │    │ id (UUID) PK            │
         │    │ conversation_id FK      │
         │    │ sender_id (UUID) FK     │
         │    │ content (TEXT)          │
         │    │ read_at (TIMESTAMP)    │
         │    │ created_at             │
         │    └─────────────────────────┘
         │
         │    ┌─────────────────────────┐
         │    │       reviews           │
         │    ├─────────────────────────┤
         ├────│ reviewer_id (UUID) FK   │
         ├────│ reviewee_id (UUID) FK   │
         │    │ listing_id (UUID) FK    │
         │    │ rating (INTEGER 1-5)    │
         │    │ comment (TEXT)          │
         │    │ created_at             │
         │    └─────────────────────────┘
         │
         │    ┌─────────────────────────┐
         │    │    refresh_tokens       │
         │    ├─────────────────────────┤
         └────│ user_id (UUID) FK       │
              │ token (VARCHAR) UNIQUE  │
              │ expires_at (TIMESTAMP)  │
              │ created_at             │
              └─────────────────────────┘

┌─────────────────────────┐
│   otp_verifications     │
│   (Upstash Redis)       │
├─────────────────────────┤
│ key: otp:{phone}        │
│ value: {hash, attempts, │
│         created_at}     │
│ TTL: 300 seconds        │
└─────────────────────────┘
```

### 5.2 Drizzle Schema

```typescript
// apps/api/src/db/schema.ts

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

export const listingStatusEnum = pgEnum('listing_status', [
  'ACTIVE',
  'SOLD',
  'EXPIRED',
  'DEACTIVATED',
]);

// ─── Users ───────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: varchar('phone', { length: 20 }).notNull().unique(),
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
  (table) => ({
    phoneIdx: uniqueIndex('users_phone_idx').on(table.phone),
    roleIdx: index('users_role_idx').on(table.role),
  })
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
    currency: varchar('currency', { length: 3 }).notNull().default('KES'),
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
  (table) => ({
    produceTypeIdx: index('listings_produce_type_idx').on(table.produceType),
    categoryIdx: index('listings_category_idx').on(table.category),
    locationIdx: index('listings_location_idx').on(table.location),
    statusIdx: index('listings_status_idx').on(table.status),
    farmerIdx: index('listings_farmer_idx').on(table.farmerId),
    availabilityIdx: index('listings_availability_idx').on(
      table.availableFrom,
      table.availableTo
    ),
    geoIdx: index('listings_geo_idx').on(table.latitude, table.longitude),
  })
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
      .references(() => produceListings.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueBuyerListing: uniqueIndex('conversations_buyer_listing_idx').on(
      table.buyerId,
      table.listingId
    ),
  })
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
  (table) => ({
    conversationIdx: index('messages_conversation_idx').on(
      table.conversationId,
      table.createdAt
    ),
  })
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
      .references(() => produceListings.id),
    rating: smallint('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueReviewerListing: uniqueIndex('reviews_reviewer_listing_idx').on(
      table.reviewerId,
      table.listingId
    ),
  })
);

// ─── Refresh Tokens ──────────────────────

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 500 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: index('refresh_tokens_token_idx').on(table.token),
    userIdx: index('refresh_tokens_user_idx').on(table.userId),
  })
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

export const produceListingsRelations = relations(
  produceListings,
  ({ one, many }) => ({
    farmer: one(users, {
      fields: [produceListings.farmerId],
      references: [users.id],
    }),
    images: many(listingImages),
    conversations: many(conversations),
    reviews: many(reviews),
  })
);

export const listingImagesRelations = relations(listingImages, ({ one }) => ({
  listing: one(produceListings, {
    fields: [listingImages.listingId],
    references: [produceListings.id],
  }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    buyer: one(users, {
      fields: [conversations.buyerId],
      references: [users.id],
    }),
    listing: one(produceListings, {
      fields: [conversations.listingId],
      references: [produceListings.id],
    }),
    messages: many(messages),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
    relationName: 'reviewer',
  }),
  reviewee: one(users, {
    fields: [reviews.revieweeId],
    references: [users.id],
    relationName: 'reviewee',
  }),
  listing: one(produceListings, {
    fields: [reviews.listingId],
    references: [produceListings.id],
  }),
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
```

### 5.3 Drizzle Client (Neon Connection)

> **As built:** `apps/api/src/db/index.ts` uses PGlite when `DATABASE_URL` is empty and Neon when set, runs migrations on start, and takes a `pglite.lock` so only one process uses the folder. Default currency is `GHS`. Schema tables match section 5.2 (`users`, `produce_listings`, `listing_images`, `conversations`, `messages`, `reviews`, `refresh_tokens`) with an extra admin credential migration (`0001_admin_credentials.sql`). OTP data lives in the key-value store, not in a table.

```typescript
// apps/api/src/db/index.ts

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './schema';
import { config } from '../config';

// Enable WebSocket for Node.js (not needed in edge/serverless)
neonConfig.webSocketConstructor = ws;

// Connection pool (persistent connections for traditional Node server)
const pool = new Pool({
  connectionString: config.database.url,
  max: 20,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });

export type DB = typeof db;
```

```typescript
// Alternative: HTTP driver (for serverless/edge)
// apps/api/src/db/index.edge.ts

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

### 5.4 Drizzle Config

```typescript
// apps/api/drizzle.config.ts

import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

### 5.5 Migration Commands

```bash
# Generate SQL migration from schema changes
npm run db:generate

# Apply migrations to Neon
npm run db:migrate

# Push schema directly (dev only, no migration files)
npm run db:push

# Open Drizzle Studio (visual DB browser)
npm run db:studio

# Seed sample data
npm run db:seed
```

```json
// apps/api/package.json (scripts)
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx src/db/seed.ts"
  }
}
```

### 5.6 Migration Runner

```typescript
// apps/api/src/db/migrate.ts

import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import 'dotenv/config';

neonConfig.webSocketConstructor = ws;

async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool);

  console.log('⏳ Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✅ Migrations complete');

  await pool.end();
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
```

---

## 6. API Specification

> **As built:** see section 0.6 for the real endpoint list. Differences: base URL is `http://localhost:4000/v1` locally, phone numbers are `+233...`, and the listings list also accepts `sort`. Added: `GET /analytics/insights`, the `/reviews` routes and the whole `/admin` area.

### 6.1 Base Configuration

```
Base URL:          https://api.agrimatch.co.ke/v1
Content-Type:      application/json
Authentication:    Bearer <JWT access_token> (via cookie or header)
Rate Limiting:     100 requests/minute (auth), 20 requests/minute (OTP)
```

### 6.2 Authentication Endpoints

```
┌──────────┬────────────────────────┬─────────────────────────────────┐
│  Method  │  Endpoint              │  Description                    │
├──────────┼────────────────────────┼─────────────────────────────────┤
│  POST    │  /auth/otp/send        │  Send OTP to phone number       │
│  POST    │  /auth/otp/verify      │  Verify OTP & get tokens        │
│  POST    │  /auth/refresh         │  Refresh access token           │
│  POST    │  /auth/logout          │  Revoke refresh token           │
│  GET     │  /auth/me              │  Get current user profile       │
│  PATCH   │  /auth/me              │  Update profile (name, role)    │
└──────────┴────────────────────────┴─────────────────────────────────┘
```

#### POST /auth/otp/send
```typescript
// Request
{ "phone": "+254712345678" }

// Response 200
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "phone": "+254712345678",
    "expiresIn": 300,
    "retryAfter": 60
  }
}

// Response 429
{
  "success": false,
  "error": {
    "code": "OTP_RATE_LIMITED",
    "message": "Please wait 45 seconds before requesting another OTP"
  }
}
```

#### POST /auth/otp/verify
```typescript
// Request
{ "phone": "+254712345678", "code": "483921" }

// Response 200
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "phone": "+254712345678",
      "name": "John Kamau",
      "role": "FARMER",
      "isNewUser": false
    },
    "tokens": {
      "accessToken": "eyJhbG...",
      "refreshToken": "dGhpcyBp...",
      "expiresIn": 900
    }
  }
}
```

### 6.3 Listing Endpoints

```
┌──────────┬────────────────────────────────┬────────────────────────────────┐
│  Method  │  Endpoint                      │  Description                   │
├──────────┼────────────────────────────────┼────────────────────────────────┤
│  POST    │  /listings                     │  Create listing (Farmer)       │
│  GET     │  /listings                     │  Browse all (paginated)        │
│  GET     │  /listings/:id                 │  Get listing details           │
│  PATCH   │  /listings/:id                 │  Update listing (owner)        │
│  DELETE  │  /listings/:id                 │  Delete listing (owner)        │
│  GET     │  /listings/my                  │  Get farmer's own listings     │
│  POST    │  /listings/:id/images          │  Upload images                 │
│  DELETE  │  /listings/:id/images/:imgId   │  Remove image                  │
└──────────┴────────────────────────────────┴────────────────────────────────┘
```

### 6.4 Matching Endpoint

```
POST /match
```

```typescript
// Request
{
  "produce": "Tomatoes",
  "quantity": 200,
  "maxPrice": 60,
  "location": "Nairobi",
  "latitude": -1.2921,
  "longitude": 36.8219,
  "requiredBy": "2025-03-15",
  "organicOnly": false,
  "weights": {
    "produce": 30, "quantity": 20, "location": 25,
    "price": 15, "availability": 10
  },
  "limit": 20
}

// Response 200
{
  "success": true,
  "data": {
    "normalizedWeights": { ... },
    "results": [
      {
        "rank": 1,
        "matchScore": 0.892,
        "matchPercentage": 89,
        "matchTier": "EXCELLENT",
        "listing": { ... },
        "breakdown": {
          "produceScore": 100, "quantityScore": 85,
          "locationScore": 82, "priceScore": 90,
          "availabilityScore": 100
        },
        "distance": 42
      }
    ],
    "totalMatches": 8
  }
}
```

### 6.5 Analytics & Messaging Endpoints

```
GET  /analytics/prices              # Average prices by produce
GET  /analytics/prices/:produce     # Price history
GET  /analytics/summary             # Market summary
GET  /analytics/locations           # Listings by location

POST /conversations                 # Start conversation
GET  /conversations                 # List user's conversations
GET  /conversations/:id/messages    # Get messages
POST /conversations/:id/messages    # Send message
PATCH /conversations/:id/read       # Mark as read
```

---

## 7. Matching Algorithm

### 7.1 Algorithm Specification

**Name:** Weighted Multi-Criteria Scoring Algorithm (WMCS)
**Type:** Deterministic ranking algorithm
**Complexity:** O(n log n) where n = active listings

### 7.2 Mathematical Model

```
MatchScore(query, listing) = Σᵢ (wᵢ × sᵢ)

Where:
  i ∈ {produce, quantity, location, price, availability}
  wᵢ = normalized weight for criterion i    (Σwᵢ = 1.0)
  sᵢ = individual score for criterion i     (0.0 ≤ sᵢ ≤ 1.0)
```

### 7.3 Scoring Functions

```typescript
// Produce Score
function calcProduceScore(query: string, listing: string): number {
  if (!query) return 0.5;
  const q = query.toLowerCase().trim();
  const l = listing.toLowerCase().trim();
  if (q === l) return 1.0;
  if (l.includes(q) || q.includes(l)) return 0.5;
  if (levenshtein(q, l) <= 2) return 0.3;
  return 0.0;
}

// Quantity Score
function calcQuantityScore(need: number, have: number): number {
  if (!need || need <= 0) return 0.7;
  if (have >= need) {
    const surplusRatio = (have - need) / need;
    return Math.max(0.3, 1.0 - 0.15 * surplusRatio);
  }
  return have / need;
}

// Location Score (Haversine)
function calcLocationScore(
  buyerLat: number, buyerLng: number,
  farmerLat: number, farmerLng: number
): number {
  if (!buyerLat || !buyerLng) return 0.5;
  const dist = haversine(buyerLat, buyerLng, farmerLat, farmerLng);
  if (dist <= 10)  return 1.00;
  if (dist <= 30)  return 0.90;
  if (dist <= 50)  return 0.75;
  if (dist <= 100) return 0.55;
  if (dist <= 200) return 0.35;
  if (dist <= 500) return 0.15;
  return 0.05;
}

// Haversine Formula
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Price Score
function calcPriceScore(maxBudget: number, askPrice: number): number {
  if (!maxBudget || maxBudget <= 0) return 0.7;
  if (askPrice <= maxBudget) {
    const savingsRatio = (maxBudget - askPrice) / maxBudget;
    return Math.max(0.5, 1.0 - 0.25 * savingsRatio);
  }
  const overageRatio = (askPrice - maxBudget) / maxBudget;
  return Math.max(0.0, 1.0 - 1.5 * overageRatio);
}

// Availability Score
function calcAvailabilityScore(needed: Date | null, from: Date, to: Date): number {
  if (!needed) return 0.7;
  const n = needed.getTime(), f = from.getTime(), t = to.getTime();
  const DAY = 86400000;
  if (n >= f && n <= t) return 1.0;
  const gap = n < f ? (f - n) / DAY : (n - t) / DAY;
  if (gap <= 3)  return 0.85;
  if (gap <= 7)  return 0.65;
  if (gap <= 14) return 0.40;
  if (gap <= 30) return 0.20;
  return 0.05;
}
```

### 7.4 Match Tier Classification

| Tier | Score Range | Color |
|------|------------|-------|
| EXCELLENT | ≥ 80% | Green `#2d6a4f` |
| GOOD | 60–79% | Teal `#52b788` |
| FAIR | 40–59% | Amber `#e9c46a` |
| POOR | < 40% | Red `#e76f51` |

### 7.5 Service Implementation (Drizzle)

```typescript
// apps/api/src/services/matching.service.ts

import { db } from '../db';
import { produceListings, users } from '../db/schema';
import { and, eq, ilike } from 'drizzle-orm';
import { haversine } from '../utils/haversine';
import type { MatchQuery, MatchResult } from '../types/match.types';

class MatchingService {
  async findMatches(query: MatchQuery): Promise<MatchResult[]> {
    const weights = this.normalizeWeights(query.weights);

    // Fetch active listings with Drizzle
    const conditions = [eq(produceListings.status, 'ACTIVE')];

    if (query.produce) {
      conditions.push(ilike(produceListings.produceType, `%${query.produce}%`));
    }
    if (query.organicOnly) {
      conditions.push(eq(produceListings.isOrganic, true));
    }

    const listings = await db
      .select({
        listing: produceListings,
        farmer: {
          id: users.id,
          name: users.name,
          phone: users.phone,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(produceListings)
      .innerJoin(users, eq(produceListings.farmerId, users.id))
      .where(and(...conditions));

    const results: MatchResult[] = [];

    for (const { listing, farmer } of listings) {
      const produceScore = this.calcProduceScore(query.produce, listing.produceType);
      if (produceScore === 0 && query.produce) continue;

      const quantityScore = this.calcQuantityScore(query.quantity, Number(listing.quantity));
      const locationScore = this.calcLocationScore(
        query.latitude, query.longitude,
        Number(listing.latitude), Number(listing.longitude)
      );
      const priceScore = this.calcPriceScore(query.maxPrice, Number(listing.pricePerUnit));
      const availabilityScore = this.calcAvailabilityScore(
        query.requiredBy ? new Date(query.requiredBy) : null,
        new Date(listing.availableFrom),
        new Date(listing.availableTo)
      );

      const totalScore =
        weights.produce      * produceScore +
        weights.quantity     * quantityScore +
        weights.location     * locationScore +
        weights.price        * priceScore +
        weights.availability * availabilityScore;

      const distance = (query.latitude && query.longitude)
        ? Math.round(haversine(
            query.latitude, query.longitude,
            Number(listing.latitude), Number(listing.longitude)
          ))
        : null;

      results.push({
        listing: {
          id: listing.id,
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
          farmer,
        },
        matchScore: Math.round(totalScore * 1000) / 1000,
        matchPercentage: Math.round(totalScore * 100),
        matchTier: this.classifyTier(totalScore),
        distance,
        breakdown: {
          produceScore: Math.round(produceScore * 100),
          quantityScore: Math.round(quantityScore * 100),
          locationScore: Math.round(locationScore * 100),
          priceScore: Math.round(priceScore * 100),
          availabilityScore: Math.round(availabilityScore * 100),
        },
      });
    }

    results.sort((a, b) => b.matchScore - a.matchScore);
    const limited = results.slice(0, query.limit || 20);
    return limited.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  // ... individual scoring methods (same as above)
}

export const matchingService = new MatchingService();
```

---

## 8. Authentication Flow (Phone OTP)

> **As built:** same flow and limits (6 digits, 5 minutes, 5 attempts, 60 s cooldown, 5 per hour, 30-minute lock). The OTP is hashed and kept in the in-process key-value store (Upstash when configured), and step 6 writes the SMS to the server log instead of calling Africa's Talking.

### 8.1 Flow Diagram

```
┌──────────┐                    ┌──────────┐                ┌─────────────┐
│  Svelte  │                    │  Express │                │ Upstash     │
│  Client  │                    │  Server  │                │ Redis       │
└────┬─────┘                    └────┬─────┘                └──────┬──────┘
     │                               │                             │
     │  1. POST /auth/otp/send       │                             │
     │  { phone: "+254712345678" }   │                             │
     ├──────────────────────────────►│                             │
     │                               │  2. Validate phone          │
     │                               │  3. Check rate limit        │
     │                               ├────────────────────────────►│
     │                               │◄────────────────────────────┤
     │                               │                             │
     │                               │  4. Generate 6-digit OTP    │
     │                               │  5. bcrypt hash + store     │
     │                               ├────────────────────────────►│
     │                               │  SET otp:{phone} EX 300     │
     │                               │◄────────────────────────────┤
     │                               │                             │
     │                               │  6. SMS via Africa's        │
     │                               │     Talking                 │
     │                               │                             │
     │  7. { expiresIn: 300 }        │                             │
     │◄──────────────────────────────┤                             │
     │                               │                             │
     │  8. User enters OTP           │                             │
     │                               │                             │
     │  9. POST /auth/otp/verify     │                             │
     ├──────────────────────────────►│                             │
     │                               │ 10. GET + bcrypt compare    │
     │                               ├────────────────────────────►│
     │                               │◄────────────────────────────┤
     │                               │                             │
     │                               │ 11. Drizzle: Find/Create    │
     │                               │     User in Neon            │
     │                               │ 12. Generate JWT pair       │
     │                               │ 13. Set httpOnly cookies    │
     │                               │                             │
     │ 14. Set-Cookie: accessToken   │                             │
     │     Set-Cookie: refreshToken  │                             │
     │     { user, isNewUser }       │                             │
     │◄──────────────────────────────┤                             │
```

### 8.2 Security Controls

```
┌────────────────────────┬────────────────────────────────────────┐
│ OTP Length             │ 6 digits (100,000 – 999,999)           │
│ OTP Expiry             │ 5 minutes (300 seconds)                │
│ Max Verify Attempts    │ 5 per OTP                              │
│ Cooldown Between Sends │ 60 seconds                             │
│ Max OTPs per Hour      │ 5 per phone number                     │
│ Brute Force Lock       │ 30-min lock after 5 failed verifies    │
│ OTP Hashing            │ bcrypt before Upstash Redis storage    │
│ Transport              │ SMS (encrypted in transit)             │
└────────────────────────┴────────────────────────────────────────┘
```

### 8.3 Cookie Strategy

```
┌────────────────────────────────────────────────────────────────┐
│ Access Token    │ httpOnly, Secure, SameSite=Lax, 15 min       │
│ Refresh Token   │ httpOnly, Secure, SameSite=Strict, 7 days    │
│                 │ Path: /api/auth/refresh only                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 9. Frontend Architecture (SvelteKit)

> **As built:** the frontend is a Svelte 4 single-page app in `frontend/`, not SvelteKit. Routes are declared in `frontend/src/App.svelte` (see section 0.4) with a `Guard` component for sign-in and role checks. State is Svelte stores (`lib/auth.js`, `lib/socket.js`, `lib/saved.js`, `lib/viewed.js`, `lib/toast.js`) and a small fetch client (`lib/api.js`). The route tree and component list below are the original plan; the real layout is in section 11.

### 9.1 SvelteKit Route Map

```
src/routes/
├── +layout.svelte                    # Root layout
├── +layout.server.ts                 # Root server load
├── +error.svelte                     # Global error page
│
├── (auth)/                           # Auth group
│   ├── +layout.svelte               # Minimal auth layout
│   ├── login/
│   │   ├── +page.svelte
│   │   └── +page.server.ts
│   └── onboarding/
│       ├── +page.svelte
│       └── +page.server.ts
│
├── (app)/                            # App group (auth required)
│   ├── +layout.svelte
│   ├── +layout.server.ts
│   ├── dashboard/
│   ├── listings/
│   │   ├── new/
│   │   └── [id]/
│   │       └── edit/
│   ├── search/
│   ├── market/
│   ├── messages/
│   │   └── [conversationId]/
│   └── profile/
│
└── api/
    └── auth/
        └── refresh/
            └── +server.ts
```

### 9.2 State Management Strategy

| State Type | Tool | Example |
|-----------|------|---------|
| Server Data | SvelteKit `load()` | Listings fetched on SSR |
| Form State | Superforms + actions | Create listing, login |
| Auth State | `event.locals` + cookies | User session from JWT cookie |
| UI State | Svelte 5 `$state` | Sidebar open, modal visible |
| Shared Client | Svelte stores | Socket connection, notifications |
| Derived | `$derived` | Filtered lists, computed values |

### 9.3 Component Architecture

```
src/lib/components/
├── ui/                           # Headless primitives
│   ├── Button.svelte
│   ├── Card.svelte
│   ├── Dialog.svelte
│   ├── Input.svelte
│   ├── Select.svelte
│   ├── Slider.svelte
│   ├── Badge.svelte
│   ├── Toast.svelte
│   └── Skeleton.svelte
│
├── auth/
│   ├── PhoneInput.svelte
│   └── OTPInput.svelte
│
├── listings/
│   ├── ListingCard.svelte
│   ├── ListingForm.svelte
│   ├── ListingGrid.svelte
│   ├── ProduceSelect.svelte
│   ├── LocationPicker.svelte
│   ├── ImageUploader.svelte
│   └── DateRangePicker.svelte
│
├── search/
│   ├── SearchForm.svelte
│   ├── WeightSliders.svelte
│   ├── MatchCard.svelte
│   ├── ScoreBreakdown.svelte
│   └── MatchResults.svelte
│
├── market/
│   ├── PriceTable.svelte
│   ├── PriceChart.svelte
│   └── StatsCards.svelte
│
├── messages/
│   ├── ConversationList.svelte
│   ├── ChatWindow.svelte
│   └── MessageBubble.svelte
│
└── layout/
    ├── Header.svelte
    ├── Sidebar.svelte
    ├── BottomNav.svelte
    └── AppShell.svelte
```

---

## 10. Backend Architecture

> **As built:** layers match this diagram. Rate limiting is per IP in `middleware/rateLimit.ts` over the key-value store.

### 10.1 Layered Architecture

```
┌──────────────────────────────────────────────────────┐
│                   ROUTES / ROUTER                     │
├──────────────────────────────────────────────────────┤
│                   MIDDLEWARE                          │
│  authenticate, authorize, validate, rateLimit        │
├──────────────────────────────────────────────────────┤
│                   CONTROLLERS                        │
├──────────────────────────────────────────────────────┤
│                   SERVICES                           │
│  auth, listing, matching, analytics, messaging       │
├──────────────────────────────────────────────────────┤
│                   REPOSITORIES                       │
│  Drizzle queries                                     │
├──────────────────────────────────────────────────────┤
│              Drizzle ORM + Neon driver               │
│          @neondatabase/serverless → Postgres         │
└──────────────────────────────────────────────────────┘
```

### 10.2 Middleware Pipeline

```
Request
  ▼
[ helmet ]           → Security headers
[ cors ]             → Cross-origin config
[ morgan ]           → HTTP request logging
[ express.json ]     → Body parsing
[ rateLimiter ]      → Upstash Redis rate limiting
  ▼
[ Router ]
  ├── Public: /auth/otp/*, /health
  └── Protected:
        ▼
      [ authenticate ]  → Verify JWT from cookie/header
      [ authorize ]     → Role check
      [ validate ]      → Zod schema validation
      [ Controller ]    → Business logic
      [ errorHandler ]  → Format errors
        ▼
     Response
```

---

## 11. Project Structure

> **As built:**
>
> ```
> Agri/
> ├── apps/api/                  Express 5 + TS + Drizzle (src/{config,controllers,db,middleware,repositories,routes,services,types,utils,validations,websocket}, drizzle/, tests/{unit,integration})
> ├── frontend/                  Vite + Svelte 4 SPA
> │   ├── public/                logo.png, logo-mark.png, favicons, app icons, images/ (hero + produce photos)
> │   └── src/
> │       ├── App.svelte, main.js, LandingPage.svelte
> │       ├── auth/              LoginPage, VerifyPage, OtpInput, AuthShell
> │       ├── pages/             Dashboard, Marketplace, Search, Market (Prices), MyListings, ListingForm, ListingDetail, Messages, Profile, Admin, AdminLogin, Onboarding, Credits
> │       ├── components/        Brand, SiteHeader, SiteFooter, PageLayout, Guard, Redirect, admin/, listings/, market/, marketplace/, messages/, search/, ui/
> │       ├── lib/               api.js, auth.js, socket.js, saved.js, viewed.js, marketplace.js, format.js, toast.js, credits.js
> │       └── styles/theme.css   design tokens and global styles
> ├── reference-images/          design references
> ├── project-documentation.md   this file
> └── mock.html, logo.svg        early mock-up and logo source
> ```
>
> Not present: `apps/web`, `packages/shared`, `.github/workflows`, `turbo.json`, root `package.json`.

```
agrimatch/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── apps/
│   ├── web/                           # ─── SVELTEKIT FRONTEND ───
│   │   ├── src/
│   │   │   ├── app.html
│   │   │   ├── app.css                 # Global styles + CSS variables
│   │   │   ├── app.d.ts
│   │   │   ├── hooks.server.ts         # Auth middleware (JWT cookie)
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   ├── +layout.svelte
│   │   │   │   ├── +layout.server.ts
│   │   │   │   ├── +error.svelte
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── +layout.svelte
│   │   │   │   │   ├── login/
│   │   │   │   │   │   ├── +page.svelte
│   │   │   │   │   │   └── +page.server.ts
│   │   │   │   │   └── onboarding/
│   │   │   │   │       ├── +page.svelte
│   │   │   │   │       └── +page.server.ts
│   │   │   │   ├── (app)/
│   │   │   │   │   ├── +layout.svelte
│   │   │   │   │   ├── +layout.server.ts
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── listings/
│   │   │   │   │   ├── search/
│   │   │   │   │   ├── market/
│   │   │   │   │   ├── messages/
│   │   │   │   │   └── profile/
│   │   │   │   └── api/auth/refresh/+server.ts
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   ├── components/
│   │   │   │   │   ├── ui/            # Headless primitives
│   │   │   │   │   ├── auth/
│   │   │   │   │   ├── listings/
│   │   │   │   │   ├── search/
│   │   │   │   │   ├── market/
│   │   │   │   │   ├── messages/
│   │   │   │   │   └── layout/
│   │   │   │   ├── styles/            # ─── VANILLA CSS ───
│   │   │   │   │   ├── reset.css      # Modern CSS reset
│   │   │   │   │   ├── tokens.css     # Design tokens (vars)
│   │   │   │   │   ├── typography.css # Type system
│   │   │   │   │   ├── layout.css     # Layout utilities
│   │   │   │   │   ├── forms.css      # Form controls
│   │   │   │   │   ├── buttons.css    # Button system
│   │   │   │   │   ├── animations.css # Keyframes
│   │   │   │   │   └── utilities.css  # Atomic utility classes
│   │   │   │   ├── stores/
│   │   │   │   ├── api/
│   │   │   │   ├── schemas/
│   │   │   │   ├── types/
│   │   │   │   └── utils/
│   │   │   └── params/
│   │   │
│   │   ├── static/
│   │   │   ├── favicon.svg
│   │   │   ├── manifest.json
│   │   │   └── icons/
│   │   │
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── e2e/
│   │   │
│   │   ├── svelte.config.js
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── playwright.config.ts
│   │   └── package.json
│   │
│   └── api/                           # ─── EXPRESS BACKEND ───
│       ├── src/
│       │   ├── index.ts
│       │   ├── app.ts
│       │   ├── server.ts
│       │   │
│       │   ├── config/
│       │   │   ├── index.ts
│       │   │   ├── redis.ts            # Upstash Redis client
│       │   │   ├── logger.ts
│       │   │   └── sms.ts
│       │   │
│       │   ├── db/                     # ─── DRIZZLE ───
│       │   │   ├── index.ts            # Drizzle client (Neon)
│       │   │   ├── schema.ts           # Table definitions
│       │   │   ├── migrate.ts          # Migration runner
│       │   │   └── seed.ts             # Sample data seeder
│       │   │
│       │   ├── routes/
│       │   ├── middleware/
│       │   ├── controllers/
│       │   ├── services/
│       │   │   └── matching.service.ts # ★ Core algorithm
│       │   ├── repositories/           # Drizzle query modules
│       │   ├── websocket/
│       │   ├── validations/
│       │   ├── types/
│       │   └── utils/
│       │       ├── errors.ts
│       │       ├── haversine.ts
│       │       ├── phone.ts
│       │       └── crypto.ts
│       │
│       ├── drizzle/                    # ─── GENERATED MIGRATIONS ───
│       │   ├── 0000_initial.sql
│       │   └── meta/
│       │       └── _journal.json
│       │
│       ├── tests/
│       │   ├── unit/
│       │   └── integration/
│       │
│       ├── drizzle.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   ├── schemas/
│       │   ├── constants/
│       │   └── index.ts
│       └── package.json
│
├── .env.example
├── .gitignore
├── .eslintrc.cjs
├── .prettierrc
├── turbo.json
├── package.json
└── README.md
```

---

## 12. Implementation Guide

> **As built:** the code below is the original sample. The real versions are in `apps/api/src` (for example `services/auth.service.ts` uses `bcryptjs` and the key-value store from `config/redis.ts`). Environment variables actually used are in `apps/api/.env.example` (no Africa's Talking or Cloudinary keys; `DATABASE_URL`, `DATA_DIR`, `UPSTASH_*`, `JWT_*`, `UPLOAD_DIR`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `CORS_ORIGIN`).

### 12.1 Environment Variables

```bash
# .env.example

# ─── SvelteKit ────────────────────────
PUBLIC_API_URL=http://localhost:4000/v1
VITE_WS_URL=http://localhost:4000
API_URL=http://localhost:4000/v1          # Server-side only
JWT_ACCESS_SECRET=your-256-bit-secret

# ─── Express API ─────────────────────
NODE_ENV=development
PORT=4000

# ─── Neon Database ────────────────────
DATABASE_URL=postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/agrimatch?sslmode=require

# ─── Upstash Redis ───────────────────
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# ─── JWT ─────────────────────────────
JWT_ACCESS_SECRET=your-256-bit-access-secret
JWT_REFRESH_SECRET=your-256-bit-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ─── SMS (Africa's Talking) ─────────
AT_API_KEY=your-api-key
AT_USERNAME=your-username
AT_SENDER_ID=AgriMatch

# ─── File Storage ────────────────────
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
```

### 12.2 Upstash Redis Client

```typescript
// apps/api/src/config/redis.ts

import { Redis } from '@upstash/redis';
import { config } from './index';

export const redis = new Redis({
  url: config.redis.url,
  token: config.redis.token,
});
```

### 12.3 Auth Service (with Drizzle)

```typescript
// apps/api/src/services/auth.service.ts

import { randomInt } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, refreshTokens } from '../db/schema';
import { redis } from '../config/redis';
import { config } from '../config';
import { smsService } from './sms.service';
import { BadRequestError, UnauthorizedError, RateLimitError } from '../utils/errors';

interface OTPData {
  hash: string;
  attempts: number;
  createdAt: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class AuthService {
  private readonly OTP_TTL = 300;
  private readonly OTP_COOLDOWN = 60;
  private readonly MAX_ATTEMPTS = 5;
  private readonly MAX_OTP_PER_HOUR = 5;
  private readonly LOCKOUT_DURATION = 1800;

  async sendOTP(phone: string): Promise<{ expiresIn: number; retryAfter: number }> {
    const normalizedPhone = this.normalizePhone(phone);

    // Cooldown check
    const cooldownKey = `otp:cooldown:${normalizedPhone}`;
    const cooldownExists = await redis.exists(cooldownKey);
    if (cooldownExists) {
      const ttl = await redis.ttl(cooldownKey);
      throw new RateLimitError(ttl);
    }

    // Hourly rate limit
    const hourlyKey = `otp:hourly:${normalizedPhone}`;
    const hourlyCount = await redis.incr(hourlyKey);
    if (hourlyCount === 1) await redis.expire(hourlyKey, 3600);
    if (hourlyCount > this.MAX_OTP_PER_HOUR) throw new RateLimitError(3600);

    // Lockout check
    const lockKey = `otp:lock:${normalizedPhone}`;
    const isLocked = await redis.exists(lockKey);
    if (isLocked) {
      const lockTTL = await redis.ttl(lockKey);
      throw new RateLimitError(lockTTL);
    }

    // Generate OTP
    const code = randomInt(100000, 999999).toString();
    const hash = await bcrypt.hash(code, 10);

    const otpData: OTPData = {
      hash,
      attempts: 0,
      createdAt: Date.now(),
    };

    const otpKey = `otp:${normalizedPhone}`;
    await redis.set(otpKey, JSON.stringify(otpData), { ex: this.OTP_TTL });
    await redis.set(cooldownKey, '1', { ex: this.OTP_COOLDOWN });

    await smsService.sendOTP(normalizedPhone, code);

    return { expiresIn: this.OTP_TTL, retryAfter: this.OTP_COOLDOWN };
  }

  async verifyOTP(phone: string, code: string) {
    const normalizedPhone = this.normalizePhone(phone);

    const lockKey = `otp:lock:${normalizedPhone}`;
    if (await redis.exists(lockKey)) {
      throw new UnauthorizedError('Account temporarily locked. Try again later.');
    }

    const otpKey = `otp:${normalizedPhone}`;
    const stored = await redis.get<string>(otpKey);
    if (!stored) {
      throw new UnauthorizedError('OTP expired or not found. Please request a new one.');
    }

    const otpData: OTPData = typeof stored === 'string' ? JSON.parse(stored) : (stored as OTPData);

    if (otpData.attempts >= this.MAX_ATTEMPTS) {
      await redis.del(otpKey);
      await redis.set(lockKey, '1', { ex: this.LOCKOUT_DURATION });
      throw new UnauthorizedError('Too many failed attempts. Account locked for 30 minutes.');
    }

    const isValid = await bcrypt.compare(code, otpData.hash);

    if (!isValid) {
      otpData.attempts++;
      await redis.set(otpKey, JSON.stringify(otpData), { keepTtl: true });
      const remaining = this.MAX_ATTEMPTS - otpData.attempts;
      throw new UnauthorizedError(
        `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      );
    }

    await redis.del(otpKey);

    // Find or create user with Drizzle
    let isNewUser = false;
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.phone, normalizedPhone))
      .limit(1);

    if (!user) {
      isNewUser = true;
      [user] = await db
        .insert(users)
        .values({
          phone: normalizedPhone,
          phoneVerified: true,
        })
        .returning();
    } else {
      [user] = await db
        .update(users)
        .set({
          phoneVerified: true,
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
    }

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        isNewUser,
      },
      tokens,
      isNewUser,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, refreshToken))
      .limit(1);

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired or revoked');
    }

    // Rotate: delete old token
    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, stored.userId))
      .limit(1);

    if (!user) throw new UnauthorizedError('User not found');

    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
  }

  private async generateTokens(user: typeof users.$inferSelect): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { sub: user.id, phone: user.phone, role: user.role },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn }
    );

    const refreshToken = jwt.sign(
      { sub: user.id, jti: crypto.randomUUID() },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    await db.insert(refreshTokens).values({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  private normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('07') || cleaned.startsWith('01')) {
      cleaned = '+254' + cleaned.slice(1);
    }
    if (cleaned.startsWith('254')) cleaned = '+' + cleaned;
    if (!/^\+\d{10,15}$/.test(cleaned)) {
      throw new BadRequestError('Invalid phone number format');
    }
    return cleaned;
  }
}

export const authService = new AuthService();
```

### 12.4 Listing Repository (Drizzle Queries)

```typescript
// apps/api/src/repositories/listing.repository.ts

import { db } from '../db';
import { produceListings, users, listingImages } from '../db/schema';
import { and, eq, ilike, gte, lte, desc, sql } from 'drizzle-orm';
import type { NewProduceListing } from '../db/schema';

interface ListingFilters {
  produce?: string;
  category?: string;
  location?: string;
  minQuantity?: number;
  maxPrice?: number;
  organic?: boolean;
  status?: 'ACTIVE' | 'SOLD' | 'EXPIRED' | 'DEACTIVATED';
  page?: number;
  limit?: number;
}

class ListingRepository {
  async create(data: NewProduceListing) {
    const [listing] = await db.insert(produceListings).values(data).returning();
    return listing;
  }

  async findById(id: string) {
    const [result] = await db
      .select({
        listing: produceListings,
        farmer: {
          id: users.id,
          name: users.name,
          phone: users.phone,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(produceListings)
      .innerJoin(users, eq(produceListings.farmerId, users.id))
      .where(eq(produceListings.id, id))
      .limit(1);

    if (!result) return null;

    const images = await db
      .select()
      .from(listingImages)
      .where(eq(listingImages.listingId, id));

    return { ...result, images };
  }

  async findAll(filters: ListingFilters = {}) {
    const { page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const conditions = [eq(produceListings.status, filters.status || 'ACTIVE')];

    if (filters.produce) {
      conditions.push(ilike(produceListings.produceType, `%${filters.produce}%`));
    }
    if (filters.category) {
      conditions.push(eq(produceListings.category, filters.category as any));
    }
    if (filters.location) {
      conditions.push(eq(produceListings.location, filters.location));
    }
    if (filters.minQuantity !== undefined) {
      conditions.push(gte(produceListings.quantity, filters.minQuantity.toString()));
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(lte(produceListings.pricePerUnit, filters.maxPrice.toString()));
    }
    if (filters.organic) {
      conditions.push(eq(produceListings.isOrganic, true));
    }

    const [listings, totalResult] = await Promise.all([
      db
        .select({
          listing: produceListings,
          farmer: { id: users.id, name: users.name },
        })
        .from(produceListings)
        .innerJoin(users, eq(produceListings.farmerId, users.id))
        .where(and(...conditions))
        .orderBy(desc(produceListings.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(produceListings)
        .where(and(...conditions)),
    ]);

    return {
      listings,
      total: totalResult[0].count,
      page,
      limit,
      totalPages: Math.ceil(totalResult[0].count / limit),
    };
  }

  async findByFarmer(farmerId: string) {
    return await db
      .select()
      .from(produceListings)
      .where(eq(produceListings.farmerId, farmerId))
      .orderBy(desc(produceListings.createdAt));
  }

  async update(id: string, data: Partial<NewProduceListing>) {
    const [updated] = await db
      .update(produceListings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(produceListings.id, id))
      .returning();
    return updated;
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
}

export const listingRepository = new ListingRepository();
```

### 12.5 Analytics Service (Drizzle Aggregations)

```typescript
// apps/api/src/services/analytics.service.ts

import { db } from '../db';
import { produceListings } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

class AnalyticsService {
  async getMarketSummary() {
    const [summary] = await db
      .select({
        totalListings: sql<number>`count(*)::int`,
        uniqueProduce: sql<number>`count(distinct ${produceListings.produceType})::int`,
        uniqueLocations: sql<number>`count(distinct ${produceListings.location})::int`,
        totalQuantity: sql<number>`sum(${produceListings.quantity})::float`,
      })
      .from(produceListings)
      .where(eq(produceListings.status, 'ACTIVE'));

    return summary;
  }

  async getAveragePrices() {
    const prices = await db
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

    return prices;
  }

  async getListingsByLocation() {
    return await db
      .select({
        location: produceListings.location,
        count: sql<number>`count(*)::int`,
      })
      .from(produceListings)
      .where(eq(produceListings.status, 'ACTIVE'))
      .groupBy(produceListings.location)
      .orderBy(sql`count(*) desc`);
  }
}

export const analyticsService = new AnalyticsService();
```

### 12.6 Seed Script

```typescript
// apps/api/src/db/seed.ts

import { db } from './index';
import { users, produceListings } from './schema';
import 'dotenv/config';

async function seed() {
  console.log('🌱 Seeding database...');

  // Clear existing data (dev only)
  await db.delete(produceListings);
  await db.delete(users);

  // Insert sample farmers
  const farmers = await db
    .insert(users)
    .values([
      {
        phone: '+254712345678',
        name: 'John Kamau',
        role: 'FARMER',
        phoneVerified: true,
        location: 'Nairobi',
        latitude: '-1.29210000',
        longitude: '36.82190000',
      },
      {
        phone: '+254723456789',
        name: 'Mary Wanjiku',
        role: 'FARMER',
        phoneVerified: true,
        location: 'Thika',
        latitude: '-1.03960000',
        longitude: '37.09000000',
      },
      {
        phone: '+254734567890',
        name: 'Peter Ochieng',
        role: 'FARMER',
        phoneVerified: true,
        location: 'Nakuru',
        latitude: '-0.30310000',
        longitude: '36.08000000',
      },
    ])
    .returning();

  // Insert sample listings
  await db.insert(produceListings).values([
    {
      farmerId: farmers[0].id,
      produceType: 'Tomatoes',
      category: 'VEGETABLES',
      quantity: '500',
      unit: 'KG',
      pricePerUnit: '45',
      location: 'Nairobi',
      latitude: '-1.29210000',
      longitude: '36.82190000',
      availableFrom: '2025-02-01',
      availableTo: '2025-04-30',
      isOrganic: false,
      description: 'Fresh greenhouse tomatoes, Grade A',
    },
    {
      farmerId: farmers[1].id,
      produceType: 'Tomatoes',
      category: 'VEGETABLES',
      quantity: '300',
      unit: 'KG',
      pricePerUnit: '55',
      location: 'Thika',
      latitude: '-1.03960000',
      longitude: '37.09000000',
      availableFrom: '2025-01-20',
      availableTo: '2025-04-15',
      isOrganic: true,
      description: 'Organic open-field tomatoes',
    },
    {
      farmerId: farmers[2].id,
      produceType: 'Onions',
      category: 'VEGETABLES',
      quantity: '1000',
      unit: 'KG',
      pricePerUnit: '35',
      location: 'Nakuru',
      latitude: '-0.30310000',
      longitude: '36.08000000',
      availableFrom: '2025-01-10',
      availableTo: '2025-02-28',
      isOrganic: false,
      description: 'Red Creole onions, well cured',
    },
  ]);

  console.log('✅ Seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
```

---

## 13. Styling System (Vanilla CSS)

> **As built:** one token file, `frontend/src/styles/theme.css` (colours, `--ramp-*` greens, tints, 4/8 spacing scale, radius, shadows, type scale, `--font-display: Anton`), with component-scoped CSS. Brand: deep green and orange. Light theme only. The multi-file split and the example components below were not used.

### 13.1 Design Token System

```css
/* apps/web/src/lib/styles/tokens.css */

:root {
  /* ─── Colors ───────────────────────────────── */

  /* Brand palette */
  --color-primary-50:  #f0f7f2;
  --color-primary-100: #d1ebd8;
  --color-primary-200: #a3d7b2;
  --color-primary-300: #75c38c;
  --color-primary-400: #52b788;
  --color-primary-500: #40916c;
  --color-primary-600: #2d6a4f;
  --color-primary-700: #1b4332;
  --color-primary-800: #142e22;
  --color-primary-900: #0a1810;

  /* Semantic colors */
  --color-success: #2d6a4f;
  --color-warning: #e9c46a;
  --color-danger:  #e76f51;
  --color-info:    #4a90e2;

  /* Neutrals */
  --color-gray-50:  #fafafa;
  --color-gray-100: #f5f5f5;
  --color-gray-200: #e5e5e5;
  --color-gray-300: #d4d4d4;
  --color-gray-400: #a3a3a3;
  --color-gray-500: #737373;
  --color-gray-600: #525252;
  --color-gray-700: #404040;
  --color-gray-800: #262626;
  --color-gray-900: #171717;

  /* Match tier colors */
  --color-tier-excellent: var(--color-primary-600);
  --color-tier-good:      var(--color-primary-400);
  --color-tier-fair:      var(--color-warning);
  --color-tier-poor:      var(--color-danger);

  /* Surfaces */
  --color-bg:          #f0f4f0;
  --color-surface:     #ffffff;
  --color-text:        #212529;
  --color-text-muted:  #6c757d;
  --color-border:      #dee2e6;

  /* ─── Typography ───────────────────────────── */

  --font-sans: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont,
               'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;

  --text-xs:   0.75rem;    /* 12px */
  --text-sm:   0.875rem;   /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg:   1.125rem;   /* 18px */
  --text-xl:   1.25rem;    /* 20px */
  --text-2xl:  1.5rem;     /* 24px */
  --text-3xl:  1.875rem;   /* 30px */
  --text-4xl:  2.25rem;    /* 36px */

  --font-normal:    400;
  --font-medium:    500;
  --font-semibold:  600;
  --font-bold:      700;
  --font-extrabold: 800;

  --leading-tight:   1.25;
  --leading-normal:  1.5;
  --leading-relaxed: 1.75;

  /* ─── Spacing ──────────────────────────────── */

  --space-0:   0;
  --space-1:   0.25rem;  /* 4px */
  --space-2:   0.5rem;   /* 8px */
  --space-3:   0.75rem;  /* 12px */
  --space-4:   1rem;     /* 16px */
  --space-5:   1.25rem;  /* 20px */
  --space-6:   1.5rem;   /* 24px */
  --space-8:   2rem;     /* 32px */
  --space-10:  2.5rem;   /* 40px */
  --space-12:  3rem;     /* 48px */
  --space-16:  4rem;     /* 64px */
  --space-20:  5rem;     /* 80px */

  /* ─── Borders & Radius ─────────────────────── */

  --radius-sm:   0.25rem;  /* 4px */
  --radius:      0.5rem;   /* 8px */
  --radius-md:   0.75rem;  /* 12px */
  --radius-lg:   1rem;     /* 16px */
  --radius-xl:   1.5rem;   /* 24px */
  --radius-full: 9999px;

  --border-width: 1px;
  --border-width-2: 2px;

  /* ─── Shadows ──────────────────────────────── */

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow:    0 2px 12px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.10);
  --shadow-lg: 0 8px 30px rgba(0,0,0,0.12);
  --shadow-xl: 0 16px 48px rgba(0,0,0,0.15);

  /* ─── Transitions ──────────────────────────── */

  --transition-fast: 150ms ease;
  --transition:      250ms ease;
  --transition-slow: 400ms ease;

  /* ─── Z-Index Scale ────────────────────────── */

  --z-dropdown:  10;
  --z-sticky:    100;
  --z-modal:     1000;
  --z-toast:     2000;
  --z-tooltip:   3000;

  /* ─── Breakpoints (use with @container or media) ─ */

  --bp-sm:   640px;
  --bp-md:   768px;
  --bp-lg:   1024px;
  --bp-xl:   1280px;

  /* ─── Container widths ─────────────────────── */

  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1280px;
  --container-2xl: 1400px;
}

/* Dark mode (toggle with data-theme="dark") */
[data-theme="dark"] {
  --color-bg:         #0f1612;
  --color-surface:    #1a2420;
  --color-text:       #e8f0ea;
  --color-text-muted: #94a3a0;
  --color-border:     #2e3a34;
}
```

### 13.2 Modern CSS Reset

```css
/* apps/web/src/lib/styles/reset.css */

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  tab-size: 4;
}

body {
  min-height: 100vh;
  min-height: 100dvh;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--color-text);
  background: var(--color-bg);
}

img,
picture,
video,
canvas,
svg {
  display: block;
  max-width: 100%;
  height: auto;
}

input,
button,
textarea,
select {
  font: inherit;
  color: inherit;
}

button {
  cursor: pointer;
  background: none;
  border: none;
}

a {
  color: inherit;
  text-decoration: none;
}

ul,
ol {
  list-style: none;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: inherit;
  font-size: inherit;
  line-height: var(--leading-tight);
  text-wrap: balance;
}

p {
  text-wrap: pretty;
}

:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

::selection {
  background: var(--color-primary-200);
  color: var(--color-primary-900);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: var(--color-bg);
}
::-webkit-scrollbar-thumb {
  background: var(--color-primary-400);
  border-radius: var(--radius);
}
::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary-600);
}

/* Motion preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 13.3 Global Styles Entry Point

```css
/* apps/web/src/app.css */

@layer reset, tokens, base, components, utilities;

@import './lib/styles/reset.css'      layer(reset);
@import './lib/styles/tokens.css'     layer(tokens);
@import './lib/styles/typography.css' layer(base);
@import './lib/styles/layout.css'     layer(base);
@import './lib/styles/forms.css'      layer(components);
@import './lib/styles/buttons.css'    layer(components);
@import './lib/styles/animations.css' layer(base);
@import './lib/styles/utilities.css'  layer(utilities);
```

### 13.4 Typography

```css
/* apps/web/src/lib/styles/typography.css */

.heading-1 {
  font-size: var(--text-4xl);
  font-weight: var(--font-extrabold);
  line-height: var(--leading-tight);
  color: var(--color-primary-700);
}

.heading-2 {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  color: var(--color-primary-700);
}

.heading-3 {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-primary-700);
}

.heading-4 {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text);
}

.text-muted {
  color: var(--color-text-muted);
}

.text-small {
  font-size: var(--text-sm);
}

.text-tiny {
  font-size: var(--text-xs);
}
```

### 13.5 Layout

```css
/* apps/web/src/lib/styles/layout.css */

.container {
  width: 100%;
  margin-inline: auto;
  padding-inline: var(--space-4);
  max-width: var(--container-2xl);
}

@media (min-width: 640px)  { .container { padding-inline: var(--space-6); } }
@media (min-width: 1024px) { .container { padding-inline: var(--space-8); } }

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.stack-sm { gap: var(--space-2); }
.stack-lg { gap: var(--space-6); }
.stack-xl { gap: var(--space-8); }

.cluster {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.grid {
  display: grid;
  gap: var(--space-4);
}

.grid-auto-fit {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
}

.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }

@media (max-width: 768px) {
  .grid-2, .grid-3, .grid-4 {
    grid-template-columns: 1fr;
  }
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### 13.6 Buttons

```css
/* apps/web/src/lib/styles/buttons.css */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  line-height: 1;
  border-radius: var(--radius);
  border: var(--border-width-2) solid transparent;
  cursor: pointer;
  transition: var(--transition);
  text-decoration: none;
  white-space: nowrap;
  user-select: none;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary-500);
    outline-offset: 2px;
  }
}

.btn-primary {
  background: linear-gradient(135deg,
    var(--color-primary-600),
    var(--color-primary-500));
  color: white;
  box-shadow: 0 4px 15px color-mix(in srgb, var(--color-primary-600) 30%, transparent);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px color-mix(in srgb, var(--color-primary-600) 40%, transparent);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-primary-700);
  border-color: var(--color-border);

  &:hover:not(:disabled) {
    background: var(--color-gray-50);
    border-color: var(--color-primary-400);
  }
}

.btn-outline {
  background: transparent;
  color: var(--color-primary-600);
  border-color: var(--color-primary-600);

  &:hover:not(:disabled) {
    background: var(--color-primary-600);
    color: white;
  }
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
  border-color: transparent;

  &:hover:not(:disabled) {
    background: var(--color-gray-100);
    color: var(--color-text);
  }
}

.btn-danger {
  background: var(--color-danger);
  color: white;

  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-danger) 85%, black);
  }
}

.btn-sm {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-xs);
}

.btn-lg {
  padding: var(--space-4) var(--space-8);
  font-size: var(--text-base);
}

.btn-block {
  width: 100%;
}

.btn-group {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}
```

### 13.7 Forms

```css
/* apps/web/src/lib/styles/forms.css */

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.form-label-required::after {
  content: '*';
  color: var(--color-danger);
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  background: var(--color-gray-50);
  border: var(--border-width-2) solid var(--color-border);
  border-radius: var(--radius);
  transition: var(--transition-fast);
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: var(--color-primary-500);
    background: var(--color-surface);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 15%, transparent);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &[aria-invalid="true"] {
    border-color: var(--color-danger);
  }
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23525252' stroke-width='2'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--space-4) center;
  padding-right: var(--space-10);
}

.form-checkbox,
.form-radio {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary-600);
  cursor: pointer;
}

.form-checkbox-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);

  & label {
    cursor: pointer;
    font-size: var(--text-sm);
  }
}

.form-error {
  font-size: var(--text-xs);
  color: var(--color-danger);
  margin-top: var(--space-1);
}

.form-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

/* OTP Input (6 digits) */
.otp-input-group {
  display: flex;
  gap: var(--space-2);
  justify-content: center;
}

.otp-input {
  width: 50px;
  height: 60px;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  text-align: center;
  background: var(--color-gray-50);
  border: var(--border-width-2) solid var(--color-border);
  border-radius: var(--radius);

  &:focus {
    outline: none;
    border-color: var(--color-primary-500);
    background: var(--color-surface);
  }
}

/* Range sliders */
.form-range {
  width: 100%;
  height: 6px;
  accent-color: var(--color-primary-600);
  cursor: pointer;
}
```

### 13.8 Animations

```css
/* apps/web/src/lib/styles/animations.css */

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}

@keyframes skeleton {
  0%   { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}

.animate-fade-in  { animation: fadeIn  var(--transition); }
.animate-slide-up { animation: slideUp var(--transition); }
.animate-spin     { animation: spin 1s linear infinite; }
.animate-pulse    { animation: pulse 2s ease-in-out infinite; }

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-gray-200) 0px,
    var(--color-gray-100) 40px,
    var(--color-gray-200) 80px
  );
  background-size: 200px 100%;
  animation: skeleton 1.5s linear infinite;
  border-radius: var(--radius);
}
```

### 13.9 Utility Classes

```css
/* apps/web/src/lib/styles/utilities.css */

/* Text alignment */
.text-left   { text-align: left; }
.text-center { text-align: center; }
.text-right  { text-align: right; }

/* Font weight */
.font-normal     { font-weight: var(--font-normal); }
.font-medium     { font-weight: var(--font-medium); }
.font-semibold   { font-weight: var(--font-semibold); }
.font-bold       { font-weight: var(--font-bold); }
.font-extrabold  { font-weight: var(--font-extrabold); }

/* Margins */
.m-0 { margin: 0; }
.mt-1 { margin-top: var(--space-1); }
.mt-2 { margin-top: var(--space-2); }
.mt-3 { margin-top: var(--space-3); }
.mt-4 { margin-top: var(--space-4); }
.mt-6 { margin-top: var(--space-6); }
.mt-8 { margin-top: var(--space-8); }
.mb-1 { margin-bottom: var(--space-1); }
.mb-2 { margin-bottom: var(--space-2); }
.mb-3 { margin-bottom: var(--space-3); }
.mb-4 { margin-bottom: var(--space-4); }
.mb-6 { margin-bottom: var(--space-6); }
.mb-8 { margin-bottom: var(--space-8); }

/* Padding */
.p-0 { padding: 0; }
.p-2 { padding: var(--space-2); }
.p-3 { padding: var(--space-3); }
.p-4 { padding: var(--space-4); }
.p-6 { padding: var(--space-6); }

/* Display */
.hidden      { display: none; }
.block       { display: block; }
.inline      { display: inline; }
.inline-block { display: inline-block; }
.flex        { display: flex; }
.inline-flex { display: inline-flex; }
.grid        { display: grid; }

/* Responsive helpers */
@media (max-width: 767px) {
  .hidden-mobile { display: none; }
}
@media (min-width: 768px) {
  .hidden-desktop { display: none; }
}
```

### 13.10 Component Example: MatchCard (Scoped CSS)

```svelte
<!-- apps/web/src/lib/components/search/MatchCard.svelte -->

<script lang="ts">
  import type { MatchResult } from '$lib/types/match';
  import ScoreBreakdown from './ScoreBreakdown.svelte';
  import { formatCurrency, formatDate } from '$lib/utils/format';

  interface Props { result: MatchResult; }
  let { result }: Props = $props();

  let showBreakdown = $state(false);
  let showContact = $state(false);

  let tierClass = $derived(`tier-${result.matchTier.toLowerCase()}`);
</script>

<article class="match-card {tierClass}">
  <!-- Header -->
  <header class="match-header">
    <div class="match-rank-wrapper">
      <div class="rank-badge">{result.rank}</div>
      <div>
        <h3 class="produce-title">
          🌿 {result.listing.produceType}
          {#if result.listing.isOrganic}
            <span class="organic-badge">🌱 Organic</span>
          {/if}
        </h3>
        <p class="farmer-info">
          by {result.listing.farmer.name} · 📍 {result.listing.location}
        </p>
      </div>
    </div>

    <div class="score-circle">
      <span class="score-value">{result.matchPercentage}%</span>
      <span class="score-label">Match</span>
    </div>
  </header>

  <!-- Details -->
  <div class="match-details">
    <div class="detail-item">
      <div class="detail-value">{result.listing.quantity.toLocaleString()} {result.listing.unit.toLowerCase()}</div>
      <div class="detail-label">Quantity</div>
    </div>
    <div class="detail-item">
      <div class="detail-value">{formatCurrency(result.listing.pricePerUnit)}</div>
      <div class="detail-label">Price/{result.listing.unit.toLowerCase()}</div>
    </div>
    <div class="detail-item">
      <div class="detail-value">{formatDate(result.listing.availableFrom)}</div>
      <div class="detail-label">Available</div>
    </div>
    {#if result.distance !== null}
      <div class="detail-item">
        <div class="detail-value">{result.distance} km</div>
        <div class="detail-label">Distance</div>
      </div>
    {/if}
  </div>

  {#if result.listing.description}
    <p class="description">📝 {result.listing.description}</p>
  {/if}

  <!-- Breakdown Toggle -->
  <div class="breakdown-section">
    <button
      type="button"
      class="breakdown-toggle"
      onclick={() => (showBreakdown = !showBreakdown)}
      aria-expanded={showBreakdown}
    >
      {showBreakdown ? '▼ Hide' : '▶ Show'} Score Breakdown
    </button>

    {#if showBreakdown}
      <div class="breakdown-content animate-slide-up">
        <ScoreBreakdown breakdown={result.breakdown} />
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <footer class="match-footer">
    <span class="total-value">
      Total: {formatCurrency(result.listing.pricePerUnit * result.listing.quantity)}
    </span>
    <button class="btn btn-primary btn-sm" onclick={() => (showContact = true)}>
      📞 Contact Seller
    </button>
  </footer>
</article>

<style>
  .match-card {
    background: var(--color-surface);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow);
    border: var(--border-width-2) solid var(--color-border);
    overflow: hidden;
    transition: var(--transition);

    &:hover {
      box-shadow: var(--shadow-lg);
    }
  }

  .tier-excellent { border-color: var(--color-tier-excellent); }
  .tier-good      { border-color: var(--color-tier-good); }
  .tier-fair      { border-color: var(--color-tier-fair); }
  .tier-poor      { border-color: var(--color-tier-poor); }

  .match-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .match-rank-wrapper {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .rank-badge {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    color: white;
    flex-shrink: 0;
  }

  .tier-excellent .rank-badge,
  .tier-excellent .score-circle { background: var(--color-tier-excellent); }
  .tier-good .rank-badge,
  .tier-good .score-circle      { background: var(--color-tier-good); }
  .tier-fair .rank-badge,
  .tier-fair .score-circle      { background: var(--color-tier-fair); color: var(--color-gray-900); }
  .tier-poor .rank-badge,
  .tier-poor .score-circle      { background: var(--color-tier-poor); }

  .produce-title {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    color: var(--color-primary-700);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .organic-badge {
    background: var(--color-primary-100);
    color: var(--color-primary-800);
    padding: 2px var(--space-2);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
  }

  .farmer-info {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .score-circle {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-full);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
  }

  .score-value {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
  }

  .score-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.9;
  }

  .match-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--space-2);
    padding: 0 var(--space-4);
  }

  .detail-item {
    background: var(--color-gray-50);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    text-align: center;
  }

  .detail-value {
    font-weight: var(--font-bold);
    color: var(--color-primary-700);
    font-size: var(--text-sm);
  }

  .detail-label {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    margin-top: 2px;
  }

  .description {
    padding: var(--space-3) var(--space-4) 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .breakdown-section {
    padding: var(--space-3) var(--space-4) 0;
  }

  .breakdown-toggle {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-primary-600);
    cursor: pointer;

    &:hover { text-decoration: underline; }
  }

  .breakdown-content {
    margin-top: var(--space-2);
  }

  .match-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-3);
    padding: var(--space-4);
    background: var(--color-gray-50);
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .total-value {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-weight: var(--font-medium);
  }

  @media (max-width: 640px) {
    .match-header {
      flex-direction: column;
      text-align: center;
    }
    .match-rank-wrapper {
      flex-direction: column;
    }
  }
</style>
```

### 13.11 ScoreBreakdown Component

```svelte
<!-- apps/web/src/lib/components/search/ScoreBreakdown.svelte -->

<script lang="ts">
  interface Props {
    breakdown: {
      produceScore: number;
      quantityScore: number;
      locationScore: number;
      priceScore: number;
      availabilityScore: number;
    };
  }

  let { breakdown }: Props = $props();

  const criteria = $derived([
    { label: 'Produce',      score: breakdown.produceScore },
    { label: 'Quantity',     score: breakdown.quantityScore },
    { label: 'Location',    score: breakdown.locationScore },
    { label: 'Price',       score: breakdown.priceScore },
    { label: 'Availability', score: breakdown.availabilityScore },
  ]);

  function barColorClass(score: number): string {
    if (score >= 70) return 'bar-excellent';
    if (score >= 50) return 'bar-good';
    if (score >= 30) return 'bar-fair';
    return 'bar-poor';
  }
</script>

<div class="breakdown">
  {#each criteria as { label, score }}
    <div class="breakdown-row">
      <span class="breakdown-label">{label}</span>
      <div class="breakdown-track">
        <div
          class="breakdown-fill {barColorClass(score)}"
          style:width="{score}%"
        ></div>
      </div>
      <span class="breakdown-value {barColorClass(score)}">{score}%</span>
    </div>
  {/each}
</div>

<style>
  .breakdown {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .breakdown-row {
    display: grid;
    grid-template-columns: 100px 1fr 45px;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }

  .breakdown-label {
    text-align: right;
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
  }

  .breakdown-track {
    height: 10px;
    background: var(--color-gray-200);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .breakdown-fill {
    height: 100%;
    border-radius: var(--radius-full);
    transition: width 700ms ease;
  }

  .breakdown-value {
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
  }

  .bar-excellent { background: var(--color-tier-excellent); color: var(--color-tier-excellent); }
  .bar-good      { background: var(--color-tier-good);      color: var(--color-tier-good); }
  .bar-fair      { background: var(--color-tier-fair);      color: color-mix(in srgb, var(--color-tier-fair) 70%, black); }
  .bar-poor      { background: var(--color-tier-poor);      color: var(--color-tier-poor); }

  .breakdown-value.bar-excellent,
  .breakdown-value.bar-good,
  .breakdown-value.bar-fair,
  .breakdown-value.bar-poor {
    background: transparent;
  }

  @media (max-width: 480px) {
    .breakdown-row {
      grid-template-columns: 80px 1fr 40px;
      gap: var(--space-2);
      font-size: var(--text-xs);
    }
  }
</style>
```

### 13.12 Login Page

```svelte
<!-- apps/web/src/routes/(auth)/login/+page.svelte -->

<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import { z } from 'zod';
  import PhoneInput from '$lib/components/auth/PhoneInput.svelte';
  import OTPInput from '$lib/components/auth/OTPInput.svelte';

  let { data } = $props();

  let step = $state<'phone' | 'otp'>('phone');
  let phone = $state('');

  const phoneForm = superForm(data.phoneForm, {
    validators: zodClient(z.object({
      phone: z.string().min(10).regex(/^(\+254|0)[17]\d{8}$/),
    })),
    onResult: ({ result }) => {
      if (result.type === 'success') {
        phone = $phoneFormData.phone;
        step = 'otp';
      }
    },
  });

  const otpForm = superForm(data.otpForm, {
    validators: zodClient(z.object({
      phone: z.string(),
      code: z.string().length(6).regex(/^\d{6}$/),
    })),
  });

  const { form: phoneFormData, enhance: phoneEnhance, delayed: phoneDelayed, message: phoneMessage } = phoneForm;
  const { form: otpFormData, enhance: otpEnhance, delayed: otpDelayed, message: otpMessage } = otpForm;
</script>

<svelte:head>
  <title>Login — AgriMatch</title>
</svelte:head>

<div class="login-wrapper">
  <div class="login-card">
    <div class="login-header">
      <div class="logo-emoji">🌾</div>
      <h1 class="heading-2">Welcome to AgriMatch</h1>
      <p class="text-muted">
        {#if step === 'phone'}
          Enter your phone number to get started
        {:else}
          Enter the 6-digit code sent to <strong>{phone}</strong>
        {/if}
      </p>
    </div>

    {#if step === 'phone'}
      <form method="POST" action="?/sendOTP" use:phoneEnhance class="stack">
        <PhoneInput
          name="phone"
          bind:value={$phoneFormData.phone}
          error={$phoneMessage}
        />
        <button type="submit" class="btn btn-primary btn-block btn-lg" disabled={$phoneDelayed}>
          {#if $phoneDelayed}
            <span class="animate-spin">⏳</span> Sending...
          {:else}
            📱 Send OTP
          {/if}
        </button>
      </form>
    {:else}
      <form method="POST" action="?/verifyOTP" use:otpEnhance class="stack">
        <input type="hidden" name="phone" value={phone} />
        <OTPInput
          name="code"
          bind:value={$otpFormData.code}
          error={$otpMessage}
        />
        <button type="submit" class="btn btn-primary btn-block btn-lg" disabled={$otpDelayed}>
          {#if $otpDelayed}
            <span class="animate-spin">⏳</span> Verifying...
          {:else}
            ✅ Verify & Login
          {/if}
        </button>
        <button type="button" class="btn btn-ghost btn-block" onclick={() => (step = 'phone')}>
          ← Change phone number
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  .login-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    padding: var(--space-4);
    background: linear-gradient(135deg,
      var(--color-primary-50) 0%,
      var(--color-primary-100) 100%);
  }

  .login-card {
    width: 100%;
    max-width: 420px;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    padding: var(--space-8);
    animation: slideUp 400ms ease;
  }

  .login-header {
    text-align: center;
    margin-bottom: var(--space-6);
  }

  .logo-emoji {
    font-size: 4rem;
    margin-bottom: var(--space-3);
  }
</style>
```

---

## 14. Deployment

> **As built:** **not deployed yet** (section 0.9, item 4). The plan below still applies, with the frontend as a static Vite build rather than a SvelteKit adapter. CI/CD files do not exist yet.

### 14.1 Production Architecture (No Docker)

```
┌──────────────────────────────────────────────────────────────┐
│                     CDN (Cloudflare)                          │
│              Static assets, caching                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                  Hosting Platforms                            │
│                                                              │
│  SvelteKit:  Vercel / Netlify / Railway                      │
│              (adapter-vercel or adapter-node)                │
│                                                              │
│  Express:    Railway / Fly.io / Render                       │
│              (Node 22 runtime)                               │
└─────────────────┬────────────────────┬───────────────────────┘
                  │                    │
    ┌─────────────┴──────┐  ┌─────────┴──────────┐
    │  Neon Postgres     │  │   Upstash Redis    │
    │  (Serverless)      │  │   (Serverless)     │
    │  - Auto-scaling    │  │   - REST API       │
    │  - DB branching    │  │   - Pay per req    │
    │  - HTTP driver     │  │                    │
    └────────────────────┘  └────────────────────┘

    ┌────────────────────┐
    │   Cloudinary       │
    │   (Images)         │
    └────────────────────┘
```

### 14.2 SvelteKit Deployment (Vercel)

```javascript
// apps/web/svelte.config.js

import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      runtime: 'nodejs22.x',
      regions: ['fra1'],  // Closest to Kenya
    }),
    alias: {
      $components: 'src/lib/components',
      $stores: 'src/lib/stores',
      $schemas: 'src/lib/schemas',
      $styles: 'src/lib/styles',
    },
  },
};

export default config;
```

### 14.3 Express API Deployment (Railway)

```toml
# apps/api/railway.toml

[build]
builder = "nixpacks"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm run db:migrate && npm start"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10
```

### 14.4 CI/CD

```yaml
# .github/workflows/ci.yml

name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'npm' }

      - run: npm ci
      - run: npm run lint
      - run: npm run check          # svelte-check + tsc
      - run: npm run test -- --run

      - name: Build
        run: npm run build

  e2e:
    needs: lint-and-test
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: ${{ secrets.NEON_TEST_DATABASE_URL }}
      UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_TEST_URL }}
      UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_TEST_TOKEN }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'npm' }

      - run: npm ci
      - run: npm run db:push --workspace=apps/api  # Push schema to test DB
      - run: npm run db:seed --workspace=apps/api
      - run: npx playwright install --with-deps
      - run: npm run test:e2e

  deploy-web:
    needs: [lint-and-test, e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./apps/web
          vercel-args: '--prod'

  deploy-api:
    needs: [lint-and-test, e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: agrimatch-api
```

### 14.5 Local Development (No Docker)

```bash
# Install dependencies
npm install

# Set up Neon (free tier)
# 1. Sign up at neon.tech
# 2. Create project "agrimatch"
# 3. Copy connection string to .env

# Set up Upstash (free tier)
# 1. Sign up at upstash.com
# 2. Create Redis database
# 3. Copy REST URL + token to .env

# Push schema to Neon
npm run db:push --workspace=apps/api

# Seed sample data
npm run db:seed --workspace=apps/api

# Start development (runs both API + Web in parallel)
npm run dev

# Open:
# Web:         http://localhost:5173
# API:         http://localhost:4000
# DB Studio:   npx drizzle-kit studio (https://local.drizzle.studio)
```

### 14.6 Root package.json Scripts

```json
{
  "name": "agrimatch",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev":         "turbo dev",
    "build":       "turbo build",
    "lint":        "turbo lint",
    "check":       "turbo check",
    "test":        "turbo test",
    "test:e2e":    "turbo test:e2e",
    "db:generate": "npm run db:generate --workspace=apps/api",
    "db:migrate":  "npm run db:migrate  --workspace=apps/api",
    "db:push":     "npm run db:push     --workspace=apps/api",
    "db:studio":   "npm run db:studio   --workspace=apps/api",
    "db:seed":     "npm run db:seed     --workspace=apps/api"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "prettier": "^3.3.0",
    "typescript": "^5.6.0"
  }
}
```

---

## 15. Testing Strategy

> **As built:** API unit and integration tests run against an in-memory PGlite database (not Neon branches): 147 passing (section 0.8). No Playwright suite and no frontend unit tests yet.

### 15.1 Testing Pyramid

```
         ┌───────┐
         │  E2E  │           Playwright (SvelteKit)
         │  (5%) │           Auth flow, search, listing CRUD
         ├───────┤
         │       │
         │ Integ │           Vitest + test Neon branch
         │ (25%) │           Drizzle query tests
         │       │
         ├───────┤
         │       │
         │ Unit  │           Vitest
         │ (70%) │           Matching engine, utilities,
         │       │           Svelte component tests
         └───────┘
```

### 15.2 Matching Algorithm Tests

```typescript
// apps/api/tests/unit/matching.service.test.ts

import { describe, it, expect } from 'vitest';
import { MatchingService } from '../../src/services/matching.service';

describe('MatchingService', () => {
  const service = new MatchingService();

  describe('calcProduceScore', () => {
    it('returns 1.0 for exact match', () => {
      expect(service['calcProduceScore']('Tomatoes', 'Tomatoes')).toBe(1.0);
    });

    it('returns 0.5 for partial match', () => {
      expect(service['calcProduceScore']('Tomato', 'Tomatoes')).toBe(0.5);
    });

    it('returns 0.0 for no match', () => {
      expect(service['calcProduceScore']('Mangoes', 'Tomatoes')).toBe(0.0);
    });
  });

  describe('calcLocationScore (Haversine)', () => {
    it('returns 1.0 for same location', () => {
      const score = service['calcLocationScore'](-1.2921, 36.8219, -1.2921, 36.8219);
      expect(score).toBe(1.0);
    });

    it('scores proportionally to distance', () => {
      // Nairobi to Thika ≈ 42 km → should be 0.75 tier
      const score = service['calcLocationScore'](-1.2921, 36.8219, -1.0396, 37.0900);
      expect(score).toBeGreaterThanOrEqual(0.55);
      expect(score).toBeLessThanOrEqual(0.9);
    });
  });

  // ... more tests
});
```

### 15.3 Integration Tests (Neon DB Branching)

```typescript
// apps/api/tests/integration/listings.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../src/db';
import { users, produceListings } from '../../src/db/schema';
import { listingRepository } from '../../src/repositories/listing.repository';

// Uses Neon test branch (set via DATABASE_URL in CI)
describe('ListingRepository (Integration)', () => {
  let farmerId: string;

  beforeAll(async () => {
    const [farmer] = await db
      .insert(users)
      .values({ phone: '+254700000001', name: 'Test Farmer', role: 'FARMER' })
      .returning();
    farmerId = farmer.id;
  });

  afterAll(async () => {
    await db.delete(users);
  });

  it('creates and retrieves a listing', async () => {
    const created = await listingRepository.create({
      farmerId,
      produceType: 'Tomatoes',
      category: 'VEGETABLES',
      quantity: '500',
      unit: 'KG',
      pricePerUnit: '45',
      location: 'Nairobi',
      latitude: '-1.2921',
      longitude: '36.8219',
      availableFrom: '2025-02-01',
      availableTo: '2025-04-30',
    });

    expect(created.id).toBeDefined();
    expect(created.produceType).toBe('Tomatoes');

    const fetched = await listingRepository.findById(created.id);
    expect(fetched?.listing.id).toBe(created.id);
  });
});
```

### 15.4 E2E Tests (Playwright)

```typescript
// apps/web/tests/e2e/search.test.ts

import { test, expect } from '@playwright/test';

test.describe('Search & Matching', () => {
  test.beforeEach(async ({ page }) => {
    // Login via API with test token
    await page.context().addCookies([{
      name: 'accessToken',
      value: process.env.TEST_JWT!,
      domain: 'localhost',
      path: '/',
    }]);
  });

  test('displays match results with score breakdown', async ({ page }) => {
    await page.goto('/search');

    await page.selectOption('select[name="produce"]', 'Tomatoes');
    await page.fill('input[name="quantity"]', '200');
    await page.fill('input[name="maxPrice"]', '60');

    await page.click('button:has-text("Find Matches")');

    await expect(page.locator('.match-card').first()).toBeVisible();
    await expect(page.locator('.score-value').first()).toContainText('%');

    // Toggle breakdown
    await page.click('.breakdown-toggle >> nth=0');
    await expect(page.locator('.breakdown-row').first()).toBeVisible();
  });
});
```

---

## 16. Security Considerations

```
┌──────────────┬───────────────────────────────────────────────────┐
│ Auth         │ ✅ OTP hashed with bcrypt in Upstash Redis        │
│              │ ✅ Rate limiting on OTP endpoints                  │
│              │ ✅ Account lockout after 5 failed attempts         │
│              │ ✅ Short-lived access tokens (15 min) in cookies   │
│              │ ✅ httpOnly + Secure + SameSite cookies            │
│              │ ✅ Refresh token rotation (single-use)             │
│              │ ✅ SvelteKit hooks.server.ts validates every SSR   │
├──────────────┼───────────────────────────────────────────────────┤
│ Database     │ ✅ Drizzle = parameterized queries (SQLi safe)     │
│              │ ✅ Neon connection pooling via PgBouncer           │
│              │ ✅ SSL/TLS to Neon (sslmode=require)               │
│              │ ✅ Row-level access control via WHERE clauses     │
│              │ ✅ Prepared statements for hot queries             │
├──────────────┼───────────────────────────────────────────────────┤
│ SvelteKit    │ ✅ Server-side load functions (no client secrets)  │
│              │ ✅ Form actions with CSRF protection (built-in)    │
│              │ ✅ $env/static/private never exposed to client     │
│              │ ✅ Content Security Policy via hooks               │
│              │ ✅ Progressive enhancement (works without JS)      │
├──────────────┼───────────────────────────────────────────────────┤
│ API          │ ✅ Helmet.js security headers                      │
│              │ ✅ CORS restricted to SvelteKit origin             │
│              │ ✅ Zod validation on all endpoints                 │
│              │ ✅ Request body size limits (10KB JSON, 5MB files) │
│              │ ✅ Rate limiting (Upstash Redis-backed)            │
├──────────────┼───────────────────────────────────────────────────┤
│ Data         │ ✅ Phone numbers normalized + validated            │
│              │ ✅ Images scanned + resized via Sharp              │
│              │ ✅ No secrets in JWT payload                       │
│              │ ✅ Environment variables for all config            │
├──────────────┼───────────────────────────────────────────────────┤
│ Transport    │ ✅ HTTPS everywhere (SSL/TLS)                      │
│              │ ✅ HSTS headers                                    │
│              │ ✅ WSS for WebSocket connections                   │
└──────────────┴───────────────────────────────────────────────────┘
```

---

## Summary

This documentation defines a complete, production-ready agricultural marketplace system built on:

| Layer | Technology | Key Benefit |
|-------|-----------|-------------|
| **Frontend** | SvelteKit 2 + Svelte 5 (Runes) | SSR for fast loads on slow connections; progressive enhancement |
| **Styling** | **Vanilla CSS** (CSS vars, nesting, `@layer`, `color-mix()`) | Zero runtime cost; smaller bundles; modern native features |
| **Forms** | Superforms + Zod | Type-safe, progressively enhanced forms |
| **State** | Svelte 5 Runes + stores + SvelteKit load | Server-first data; minimal client state |
| **Backend** | Express 5 + TypeScript | Clean layered architecture |
| **ORM** | **Drizzle** | SQL-first, type-safe, zero runtime overhead |
| **Database** | **Neon Serverless Postgres** | Auto-scaling, DB branching, HTTP + WS drivers |
| **Cache/Queue** | **Upstash Redis** | Serverless Redis for OTP, rate limiting |
| **Auth** | Phone OTP via Africa's Talking | Accessible to rural farmers without email |
| **Real-time** | Socket.IO | Live messaging and notifications |
| **Algorithm** | Weighted Multi-Criteria Scoring | Intelligent matching across 5 dimensions |
| **Deployment** | **No Docker** — Vercel + Railway + Neon + Upstash | Simpler ops, serverless scaling |
| **Testing** | Vitest + Playwright | Unit, integration, and E2E coverage |

### Key Architectural Wins

**No Docker** → Simpler developer onboarding (`npm install && npm run dev`); platforms handle infrastructure.

**Neon + Drizzle** → Serverless Postgres with instant database branching for preview deployments; type-safe SQL-first queries that compile to raw SQL (no query engine overhead).

**Vanilla CSS** → Zero build-time dependencies for styling; uses modern CSS features (`@layer`, nesting, `color-mix()`, `oklch()`) for a design system under 20 KB gzipped; full browser DevTools debugging without source maps.

**SvelteKit SSR** → Fast Time-to-First-Byte on slow rural connections; progressive enhancement means forms work even if JavaScript fails to load — critical for agricultural users on 2G/3G.

The **matching algorithm** evaluates listings across 5 weighted dimensions (produce type, quantity, location via **Haversine distance**, price, and availability) using **O(n log n)** scoring and returns ranked results classified as Excellent / Good / Fair / Poor.