# Red Atlas — Real Estate API

Backend API for real estate management at Red Atlas. Built with NestJS (Fastify), PostgreSQL + PostGIS, TypeORM, Redis and RabbitMQ. Implements JWT auth with refresh rotation, multi-tenancy, advanced CRUD (Properties, Listings, Transactions), cursor pagination, geospatial queries, caching, and asynchronous CSV imports.

---

## 1) Local setup

- Requirements
  - Node.js 22+
  - Docker and Docker Compose
- Clone and install
  ```bash
  git clone <repo>
  cd red-atlas-challenge
  npm ci
  ```
- Environment variables: copy `.env.example` to `.env` and fill values (see next section).

### Environment (.env)
Required/Relevant variables:
- DATABASE_URL or POSTGRES_HOST/POSTGRES_PORT/POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB
- REDIS_URL
- RABBITMQ_URL
- ACCESS_TOKEN_SECRET, ACCESS_TOKEN_TTL (e.g., `15m`)
- REFRESH_TOKEN_SECRET, REFRESH_TOKEN_TTL (e.g., `7d`)
- DEFAULT_TENANT (fallback tenant id for local/dev)
- API_PORT (default: 3000)

Example:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/redatlas
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
ACCESS_TOKEN_SECRET=change-me
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_SECRET=change-me-too
REFRESH_TOKEN_TTL=7d
DEFAULT_TENANT=tenant-local
API_PORT=3000
```

### Bring up infrastructure + API (Docker)
```bash
# start postgres (with postgis), redis and rabbitmq and build images
docker compose up -d --build

# run DB migrations
npm run migration:run

# start API (watch mode)
npm run start:api

# optional: start import worker (CSV imports)
npm run start:worker:imports
```

Local (without Docker): ensure Postgres+PostGIS, Redis, RabbitMQ are running and `.env` is configured, then:
```bash
npm run build
npm run migration:run
npm run start:api
```

---

## 2) Migrations and seed

- Generate/Run/Revert migrations:
  ```bash
  npm run migration:generate
  npm run migration:run
  npm run migration:revert
  ```
- Seed dataset (idempotent, large dataset; docker-aware):
  ```bash
  npm run seed:docker
  ```

---

## 3) Architecture and modules (high level)

- `auth/` — JWT access + refresh rotation, roles (user/admin), multi-tenant enforcement.
- `properties/`, `listings/`, `transactions/` — CRUD, soft delete/restore, advanced filters and cursor pagination.
- `imports/` — CSV import via RabbitMQ (API publishes; worker consumes in batches; retries + DLQ).
- `common/` — utilities, interceptors, cache, tracing.
- `database/` — entities, migrations, indexes (GiST for geo), partitions (transactions planned).

OpenAPI/Swagger: available at `/docs` (Bearer auth). Prefix for API routes: `/v1`.

---

## 4) Caching and invalidation strategy

- Read-through cache via Redis for selected GET endpoints (e.g., `GET /v1/properties`).
- Cache key: `tenant:{tenantId}:query:{normalizedQuery}:v{cacheVersion}`
  - `normalizedQuery` = parâmetros ordenados + serializados (para idempotência de cache)
- TTL configurável por endpoint (default seguro em minutos).
- Invalidação:
  - On write (create/update/delete/restore) do recurso afetado: remoção por prefixo do tenant.
  - Bump global `cacheVersion` para invalidar em mudanças estruturais.

---

## 5) Performance — como validar (inclui métricas)

- Load testing (autocannon):
  ```bash
  # instalar
  npm i -g autocannon

  # exemplo: GET /v1/properties com filtros e paginação
  autocannon -c 200 -d 30 -p 10 \
    -H "authorization: Bearer $TOKEN" \
    "http://localhost:${API_PORT:-3000}/v1/properties?limit=25&order=desc&sector=central"
  ```
- SLOs (alvo com dataset de referência):
  - GET /v1/properties p95 ≤ 800ms (sem cache)
  - GET /v1/properties p95 ≤ 300ms (cache aquecido)
  - Error rate ≤ 1%
- Métricas (Prometheus):
  - Expostas em texto no endpoint `/v1/metrics` (content-type Prometheus `text/plain; version=0.0.4`).
  - Inclui contadores de requisição, latência (histogram), erros, métricas de import (sucesso/retry/dlq).
  - Consumo: `curl http://localhost:${API_PORT:-3000}/v1/metrics`

Dicas:
- Use `npm run start:cluster` em produção para multi-CPU.
- Monitore Postgres (latência média e planos de execução). Índices: GiST em `location::geography`, compostos para filtros mais frequentes.

---

## 6) Segurança — Checklist OWASP aplicado

- Autenticação/JWT
  - Access + Refresh com rotação e invalidação de refresh comprometido (hash em DB).
  - TTLs explícitos; segredos via env.
- Autorização
  - RBAC (user/admin) e escopo estrito por `tenantId` em todas as consultas.
- Validação e saneamento
  - DTOs com `class-validator` + `class-transformer` (query/body/params), tipos fortes.
- Transporte e cabeçalhos de segurança
  - Helmet habilitado (CSP, X-Frame-Options, X-Content-Type-Options, etc.).
  - CORS configurado (restringir em prod para os domínios da Red Atlas).
- CSRF
  - Proteção habilitada para rotas que exigirem (em APIs REST públicas, preferir Bearer + idempotência).
- Armazenamento seguro e segredos
  - Segredos apenas em env/secret manager; nunca em repositório.
  - Hash de senhas e comparação timing-safe.
- Logs e privacidade
  - Sem dados sensíveis nos logs; correlação de requisições (correlation-id).
- Injeção/SQLi
  - Query builder/params tipados pelo TypeORM; sem concatenação de strings.
- Rate limiting / DoS
  - Suportado via ingress/API gateway; documentado para produção.
- Dependências e atualizações
  - `npm audit` e CI; versões com pinagem quando necessário.

---

## 7) Endpoints principais (resumo)

Prefixo `/v1`. Exigem `Authorization: Bearer <token>`.
- Properties: `GET /properties`, `POST /properties`, `GET/PUT/PATCH/DELETE /properties/:id`, `PATCH /properties/:id/restore`
- Listings: `GET /listings`, `POST /listings`, `GET/PUT/PATCH/DELETE /listings/:id`, `PATCH /listings/:id/restore`
- Transactions: `GET /transactions`, `POST /transactions`, `GET/PATCH/DELETE /transactions/:id`, `PATCH /transactions/:id/restore`
- Imports (CSV): `POST /imports`
- Métricas: `GET /metrics` (versionado em `/v1/metrics`)

---

## 8) Scripts úteis

```bash
# build / start
npm run build
npm run start:api
npm run start:prod
npm run start:cluster

# workers
npm run start:worker:imports
npm run start:worker:imports:prod

# migrations
npm run migration:generate
npm run migration:run
npm run migration:revert

# seed (docker)
npm run seed:docker

# tests
npm run test
npm run test:watch
npm run test:cov

# utilitário CSV
npm run csv:gen
```

---

## 9) Docker cleanup e restart (fresh setup)

Para recriar tudo do zero (containers, volumes e imagens do projeto):
```bash
# parar e remover containers/volumes do compose atual
docker compose down -v

# remover imagens do projeto (ajuste o prefixo, se necessário)
docker images | awk '/red-atlas|red_atlas|redatlas/ { print $3 }' | xargs -r docker rmi -f

# remover volumes/redes órfãos (opcional)
docker volume prune -f
docker network prune -f

# subir novamente
docker compose up -d --build
npm run migration:run
npm run start:api
```

---

## 10) Licença

MIT
