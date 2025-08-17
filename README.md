<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

NestJS backend for real estate management powered by PostgreSQL + PostGIS, TypeORM, Redis, and RabbitMQ. It implements JWT authentication (with refresh rotation), multi-tenancy, advanced CRUD for `Properties`, `Listings`, and `Transactions` with soft delete/restore, strong validation, advanced filtering, cursor pagination, geospatial KNN ordering, and asynchronous CSV import via RabbitMQ.

Key capabilities:

- Multi-tenancy via `tenant_id` enforced in authorization and queries.
- Soft delete and restore (`deleted_at`).
- Validation using `class-validator` + transformation via `class-transformer`.
- Normalized errors and guards (`AuthGuard`, `RolesGuard`).
- Combined filtering, cursor pagination, Redis cache.
- Geospatial distance ordering using PostGIS `<->` when requested.
- Massive CSV async import via RabbitMQ (dedicated workers).
- Idempotent massive seed (100k+ properties, 200k listings, 150k transactions).

Useful links:

- NestJS: https://docs.nestjs.com
- TypeORM: https://typeorm.io
- PostgreSQL/PostGIS: https://postgis.net
- RabbitMQ: https://www.rabbitmq.com
- Redis: https://redis.io
- Autocannon (load testing): https://github.com/mcollina/autocannon

---

## Architecture and Modules

- `src/modules/auth/`: JWT, refresh rotation, roles (user/admin), and `@CurrentUser` decorator.
- `src/modules/properties/`: Advanced CRUD, filters, pagination, cache, and KNN ordering by distance on demand.
- `src/modules/listings/`: Advanced listings CRUD (multi-tenant, soft delete/restore).
- `src/modules/transactions/`: Advanced transactions CRUD with date/price filters.
- `src/modules/imports/`: Async CSV import pipeline via RabbitMQ (upload controller + worker consumer).
- `src/database/`: TypeORM DataSource, migrations, and indexes (including GiST for geography).
- `src/common/`: utilities and base entity with common fields (tenant, soft delete, timestamps).

Performance decisions:

- TypeORM pool increased to 50 connections.
- Fastify compression with `threshold` 10kB.
- Node cluster: multi-CPU launcher.
- Composite indexes for frequent filters and GiST on `location::geography`.

---

## Requirements

- Node.js 22+
- Docker and Docker Compose

---

## Configuration (.env)

Copy `.env.example` to `.env` and adjust accordingly.

Relevant variables:

- `DATABASE_URL` or `POSTGRES_*` (host, port, user, pass, db)
- `REDIS_URL`
- `RABBITMQ_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`

---

## Bring up infrastructure and app

Using Docker Compose (recommended):

```bash
docker compose up -d --build

# run migrations
npm run migration:run

# start API in watch mode
npm run start:api

# start CSV import worker (dev)
npm run start:worker:imports
```

RabbitMQ topology (queues):

- `imports.batch` (main) → DLX to `imports.retry.10s`
- `imports.retry.10s` (TTL 10s) → DLX to `imports.batch`
- `imports.retry.60s` (TTL 60s) → DLX to `imports.batch` (available for future backoff tiers)
- `imports.batch.dlq` (dead-letter)

Retries/backoff:

- Consumer reads `x-death` header and nacks with requeue=false for controlled backoff.
- After max attempts, message is copied to DLQ and acked (metrics labeled as `dlq`).

Local (without Docker) — ensure Postgres+PostGIS, Redis, RabbitMQ are running and `.env` is configured:

```bash
npm ci
npm run build
npm run migration:run
npm run start:api
```

Cluster (production):

```bash
npm run build
npm run start:cluster     # uses dist/src/cluster.js
```

---

## Useful scripts (package.json)

```bash
# build app + scripts TS (if applicable)
npm run build
npm run build:full

# start
npm run start            # dev helper script
npm run start:api        # Nest watch
npm run start:prod       # node dist/src/main
npm run start:cluster    # cluster in production

# workers
npm run start:worker:imports       # TS
npm run start:worker:imports:prod  # compiled JS

# migrations
npm run migration:generate
npm run migration:run
npm run migration:revert

# seed (docker) — uses dist/seed.js and compose host/port
npm run seed:docker

# lint
npm run lint:prettier:check
npm run lint:prettier:fix
npm run lint:eslint:check
npm run lint:eslint:fix

# tests
npm run test
npm run test:watch
npm run test:cov

# utility
npm run csv:gen          # generate massive CSV for import
```

---

## Main endpoints

Prefix: `/v1`

- Auth (example; verify routes in the auth module)
  - `POST /auth/login` → token + refresh
  - `POST /auth/refresh` → refresh rotation

- Properties
  - `GET /properties` — filters, cursor, ordering (distance when requested)
  - `POST /properties` — create (201)
  - `GET /properties/:id`
  - `PATCH /properties/:id`
  - `DELETE /properties/:id` — soft delete (204)
  - `PATCH /properties/:id/restore` — restore

- Listings
  - `GET /listings` — filters by `status`, `propertyId`, price range, cursor
  - `POST /listings`
  - `GET /listings/:id`
  - `PATCH /listings/:id`
  - `DELETE /listings/:id` — soft delete
  - `PATCH /listings/:id/restore`

- Transactions
  - `GET /transactions` — filters by `propertyId`, `listingId`, price and date ranges, cursor
  - `POST /transactions`
  - `GET /transactions/:id`
  - `PATCH /transactions/:id`
  - `DELETE /transactions/:id` — soft delete
  - `PATCH /transactions/:id/restore`

- Imports (CSV)
  - `POST /imports` — accepts `text/csv`; returns `202 Accepted` and a jobId

All protected routes require `Authorization: Bearer <token>` and apply the user's `tenantId`.

OpenAPI/Swagger: the project uses `@nestjs/swagger`. The docs are exposed at `/docs` with Bearer auth (JWT). Import the JWT in the authorize dialog to try protected endpoints.

Security scheme:

- Type: HTTP Bearer
- Header: `Authorization: Bearer <token>`

---

## Asynchronous CSV import (RabbitMQ)

Pipeline:

1. API receives the upload (`text/csv`) and publishes jobs to the queue.
2. Worker (`start:worker:imports`) consumes and processes batches (streaming + upsert/idempotency).
3. Job status is exposed by the API (see imports module).

Usage (example):

```bash
# generate a test CSV
npm run csv:gen -- --rows 100000 --out /tmp/import.csv

# send to API
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: text/csv" \
  --data-binary @/tmp/import.csv \
  http://localhost:3000/v1/imports
```

---

## Multi-tenancy, validation and soft delete

- All queries are scoped by the token's `tenantId`.
- DTOs use `class-validator` and `class-transformer` (including queries: `QueryPropertiesDto`, `QueryListingsDto`, `QueryTransactionsDto`).
- Soft delete/restore implemented in `Properties`, `Listings`, `Transactions`.

---

## Indexes, Geo and Performance

- GiST on `location::geography` for queries and distance ordering (KNN `<->`).
- Composite indexes for filters (e.g., `(tenant_id, sector, type, price)`).
- Redis cache (e.g., `GET /v1/properties`) with `CacheInterceptor` + TTL.
- TypeORM pool: 50 connections.
- Fastify compression threshold: 10kB.
- Node.js cluster for multi-CPU.

Scale to 1M+ records:

- Monthly partitioning on `transactions` (plan suggested in internal migrations notes).
- Partial indexes `WHERE deleted_at IS NULL` (optional) to reduce scan costs.

Cache invalidation strategy (summary):

- Read cache: Redis for `GET /v1/properties` (and others as applicable), TTL-configured.
- Cache key: composed by tenant + normalized query string (sorted keys) + version suffix.
- Invalidation:
  - On write (create/update/delete/restore) for affected entity/tenant, we delete keys by tenant prefix.
  - Version bump can be used to invalidate across the board on schema/logic changes.

---

## Massive seed (idempotent)

```bash
# Docker (uses dist/scripts/seed.js and compose host/port)
npm run seed:docker
```

Default sizes: 100k `properties`, 200k `listings`, 150k `transactions` (configurable).

---

## Tests

```bash
npm run test
npm run test:watch
npm run test:cov
```

---

## Load testing (autocannon)

Install globally if needed:

```bash
npm i -g autocannon
```

Examples:

```bash
# GET properties with filters and pagination
autocannon -c 200 -d 30 -p 10 \
  -H "Authorization=Bearer $TOKEN" \
  "http://localhost:3000/v1/properties?limit=25&order=desc&sector=central"

# GET listings (cursor pagination)
autocannon -c 200 -d 30 -p 10 \
  -H "Authorization=Bearer $TOKEN" \
  "http://localhost:3000/v1/listings?status=active&limit=25"

# GET transactions filtering by date and price
autocannon -c 200 -d 30 -p 10 \
  -H "Authorization=Bearer $TOKEN" \
  "http://localhost:3000/v1/transactions?fromDate=2025-08-01&toDate=2025-08-31&minPrice=200000&limit=25"

# POST import CSV (use a small file to test 202 acceptance throughput)
autocannon -c 50 -d 20 -m POST \
  -H "Authorization=Bearer $TOKEN" \
  -H "Content-Type=text/csv" \
  --body @/tmp/import.csv \
  http://localhost:3000/v1/imports
```

Tips:

- Use `start:cluster` to leverage all CPUs.
- Monitor Postgres (average latency ~7–8ms per query achieved after optimizations).

SLOs (targets under the prescribed dataset and 200 concurrency for 60s):

- `GET /v1/properties` p95 ≤ 800ms (no cache)
- `GET /v1/properties` p95 ≤ 300ms (with cache warm)
- Error rate ≤ 1%

Sample command (replace `$TOKEN`):

```bash
autocannon -w 15 -d 60 -c 200 -p 1 \
  -H "authorization: Bearer $TOKEN" \
  "http://localhost:3000/v1/properties?sector=Moema&type=apartment&minPrice=200000&maxPrice=1500000&latitude=-23.56&longitude=-46.64&radiusKm=5&limit=50&sortBy=price&order=asc"
```

---

## Architecture docs (ADRs & Diagrams)

- ADRs: see `docs/adr/`
  - `0001-framework-choice.md`
  - `0002-pagination-cursor-vs-offset.md`
- Diagrams (PlantUML): see `docs/diagrams/`
  - `c4-container.puml` — C4 Container view
  - `import-sequence.puml` — CSV Import flow (API → RabbitMQ → Worker → DB)

To render PlantUML, use any PlantUML-compatible viewer or the VSCode extension.

## Redis distributed lock (utility)

Utility file: `src/common/redis/redis-lock.util.ts`

Example usage:

```ts
import { Redis } from 'ioredis';
import { RedisLock } from '../common/redis/redis-lock.util';

const redis = new Redis(process.env.REDIS_URL!);
const lock = new RedisLock(redis, { ttlMs: 10_000 });

await lock.withLock(`recalc:${tenantId}`, async () => {
  // critical section here (e.g., recompute aggregates)
});
```

Notes:

- Uses SET NX PX + safe release via Lua script.
- Supports retries and timeouts; ideal to serialize critical sections and avoid race conditions.

---

## Security

- CSRF enabled (where applicable) and security headers via Helmet.
- Never commit secrets; use local/CI `.env`.
- Input validation and sanitization via DTOs (`class-validator`/`class-transformer`).
- Authentication with JWT access + refresh rotation; blacklist/rotation of compromised refresh tokens.
- Authorization with roles (`user`/`admin`) and strict tenant enforcement on all queries.
- Security headers via Helmet; CORS configured.
- Rate limiting optional (enable at ingress/proxy level for prod).
- Secrets in env; no secrets in repo.
- SQL protection: parameterized queries via TypeORM/query builder.
- Logging without sensitive data; correlation-id for traceability.

---

## License

MIT
