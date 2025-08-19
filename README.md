# Red Atlas — API Inmobiliaria

Backend para gestión inmobiliaria de Red Atlas. Construido con NestJS (Fastify), PostgreSQL + PostGIS, TypeORM, Redis y RabbitMQ. Implementa autenticación JWT con rotación de refresh, multi‑tenant, CRUD avanzado (Properties, Listings, Transactions), paginación por cursor, consultas geoespaciales, caché y importaciones CSV asíncronas.

## Inicio rápido

Seguí estos pasos para levantar el proyecto localmente. Usá dos terminales para API y worker.

```bash
# 1) Node 22 con nvm
nvm use 22

# 2) Instalar dependencias (0 vulnerabilidades)
npm i

# 3) Infraestructura local (Postgres+PostGIS, Redis, RabbitMQ)
docker compose up -d --build

# 4) Preparar base de datos
npm run migration:run

# 5) Seed de datos iniciales
npm run seed

# 6) (Opcional) Generar CSV grande para probar import con colas
npm run csv:gen

# 7) Levantar la API (primer terminal)
npm run start:api

# 8) Levantar el worker de importación (segunda terminal)
npm run start:worker:imports
```

Listo. Abrí Swagger en `http://localhost:3000/docs` para explorar la API.

---

## 1) Configuración local

- Requisitos
  - Node.js 22+
  - Docker y Docker Compose
- Variables de entorno: copiá `.env.example` a `.env` y completá los valores (ver próxima sección).

### Entorno (.env)

Variables requeridas/relevantes:

- DATABASE_URL or POSTGRES_HOST/POSTGRES_PORT/POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB
- REDIS_URL
- RABBITMQ_URL
- ACCESS_TOKEN_SECRET, ACCESS_TOKEN_TTL (e.g., `15m`)
- REFRESH_TOKEN_SECRET, REFRESH_TOKEN_TTL (e.g., `7d`)
- DEFAULT_TENANT (fallback tenant id for local/dev)
- API_PORT (default: 3000)

Ejemplo:

```env
API_PORT=3000
NODE_ENV=development
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace_me
POSTGRES_DB=redatlas
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_PORT=5672
RABBITMQ_MGMT_PORT=15672
RABBITMQ_DEFAULT_USER=guest
RABBITMQ_DEFAULT_PASS=guest
ACCESS_TOKEN_SECRET=replace_me
ACCESS_TOKEN_TTL=1h
REFRESH_TOKEN_SECRET=replace_me
REFRESH_TOKEN_TTL=7d
DEFAULT_TENANT=public
```

### Levantar infraestructura + API (Docker)

```bash
# Levantar Postgres (con PostGIS), Redis y RabbitMQ y buildear imágenes
docker compose up -d --build

# Correr migraciones de la base
npm run migration:run

# Iniciar la API (watch mode)
npm run start:api

# Opcional: iniciar worker de importación CSV
npm run start:worker:imports
```

Local (sin Docker): asegurate de tener Postgres+PostGIS, Redis y RabbitMQ corriendo y `.env` configurado, luego:

```bash
npm run build
npm run migration:run
npm run start:api
```

---

## 2) Migraciones y seed

- Generar/Ejecutar/Revertir migraciones:
  ```bash
  npm run migration:generate
  npm run migration:run
  npm run migration:revert
  ```
- Poblar dataset (idempotente, volumen grande; compatible con Docker):
  ```bash
  npm run seed:docker
  ```

---

## 3) Arquitectura y módulos (alto nivel)

- `auth/` — JWT access + rotación de refresh, roles (user/admin), enforcement multi‑tenant.
- `properties/`, `listings/`, `transactions/` — CRUD, soft delete/restore, filtros avanzados y paginación por cursor.
- `imports/` — Importación CSV vía RabbitMQ (la API publica; el worker consume en batches; retries + DLQ).
- `common/` — utilidades, interceptores, caché, tracing.
- `database/` — entidades, migraciones, índices (GiST para geo), particiones (transactions planificado).

OpenAPI/Swagger: disponible en `/docs` (Bearer auth). Prefijo de rutas: `/v1`.

---

## 4) Estrategia de caché e invalidación

- Caché read‑through con Redis para endpoints GET seleccionados (ej.: `GET /v1/properties`).
- Clave de caché: `tenant:{tenantId}:query:{normalizedQuery}:v{cacheVersion}`
  - `normalizedQuery` = parámetros ordenados + serializados (para idempotencia de caché)
- TTL configurable por endpoint (default seguro en minutos).
- Invalidación:
  - En escrituras (create/update/delete/restore) del recurso afectado: remoción por prefijo del tenant.
  - Bump global de `cacheVersion` ante cambios estructurales.

---

## 5) Performance — cómo validar (incluye métricas)

- Pruebas de carga (autocannon):

  ```bash
  # instalar autocannon
  npm i -g autocannon

  # ejemplo: GET /v1/properties con filtros y paginación
  autocannon -c 200 -d 60 -p 1 \
    -H "Authorization: Bearer <TOKEN>" \
    "http://localhost:3000/v1/properties?limit=25&order=desc&sector=central"
  ```

- SLOs (objetivo con dataset de referencia):
  - GET /v1/properties p95 ≤ 800ms (sin caché)
  - GET /v1/properties p95 ≤ 300ms (caché caliente)
  - Error rate ≤ 1%
- Métricas (Prometheus):
  - Expuestas como texto en `/v1/metrics` (content‑type Prometheus `text/plain; version=0.0.4`).
  - Incluye contadores de request, latencia (histograma), errores, métricas de import (éxito/retry/dlq).
  - Consumo: `curl http://localhost:${API_PORT:-3000}/v1/metrics`

Tips:

- Usá `npm run start:cluster` en producción para multi‑CPU.
- Monitoreá Postgres (latencia promedio y planes de ejecución). Índices: GiST en `location::geography`, compuestos para filtros frecuentes.

---

## 6) Seguridad — Checklist OWASP aplicado

- Autenticación/JWT
  - Access + Refresh con rotación y invalidación de refresh comprometido (hash en DB).
  - TTLs explícitos; secretos vía env.
- Autorización
  - RBAC (user/admin) y scope estricto por `tenantId` en todas las consultas.
- Validación y saneamiento
  - DTOs con `class-validator` + `class-transformer` (query/body/params), tipado fuerte.
- Transporte y headers de seguridad
  - Helmet habilitado (CSP, X-Frame-Options, X-Content-Type-Options, etc.).
  - CORS configurado (restringir en prod a los dominios de Red Atlas).
- CSRF
  - Protección habilitada para rutas que lo requieran (en APIs REST públicas, preferir Bearer + idempotencia).
- Almacenamiento seguro y secretos
  - Secretos solo en env/secret manager; nunca en el repo.
  - Hash de contraseñas y comparación timing‑safe.
- Logs y privacidad
  - Sin datos sensibles en logs; correlación de requests (correlation-id).
- Auditoría (Audit logs)
  - Requests HTTP mutables (POST/PUT/PATCH/DELETE) se registran via `AuditInterceptor`.
  - Campos en `audit_logs`:
    - method (HTTP), path (URL), userId (uuid|null), tenantId (uuid|null)
    - entity (ruta inferida, ej.: `properties`), entityId (`params.id` o null)
    - before (siempre null en el estado actual), after (body enviado)
    - createdAt (timestamp del registro)
  - Best‑effort: fallas al persistir no interrumpen la respuesta (se loguea warning).
  - Implementación: `src/modules/audit/services/audit.interceptor.ts`, `src/modules/audit/entities/audit-log.entity.ts`, `src/modules/audit/services/audit.service.ts`.
- Inyección/SQLi
  - Query builder/params tipados por TypeORM; sin concatenar strings.
- Rate limiting / DoS
  - Soportado vía ingress/API gateway; documentado para producción.
- Dependencias y actualizaciones
  - `npm audit` y CI; versiones pinneadas cuando sea necesario.

---

## 7) Endpoints principales (resumen)

Prefijo `/v1`. Requieren `Authorization: Bearer <token>`.

- Properties: `GET /properties`, `POST /properties`, `GET/PUT/PATCH/DELETE /properties/:id`, `PATCH /properties/:id/restore`
- Listings: `GET /listings`, `POST /listings`, `GET/PUT/PATCH/DELETE /listings/:id`, `PATCH /listings/:id/restore`
- Transactions: `GET /transactions`, `POST /transactions`, `GET/PATCH/DELETE /transactions/:id`, `PATCH /transactions/:id/restore`
- Imports (CSV): `POST /imports`

---

## 8) Scripts útiles

### Ejemplo: importación de CSV vía curl

Usá un token JWT válido en el header `Authorization`. Reemplazá `$TOKEN` por tu token (obtenido via `POST /v1/auth/login`).

```bash
curl -v -X POST "http://localhost:3000/v1/imports" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Idempotency-Key: job-csv-001" \
  -H "Content-Type: text/csv" \
  --data-binary @data/properties-import.csv
```

Notas:

- `Idempotency-Key` debe ser único por job para evitar reprocesamiento.
- El archivo `data/properties-import.csv` se puede generar con `npm run csv:gen`.

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

## 9) Limpieza y restart de Docker (fresh setup)

Para recrear todo desde cero (containers, volúmenes e imágenes del proyecto):

```bash
# parar y remover containers/volúmenes del compose actual
docker compose down -v

# remover volúmenes/redes huérfanas (opcional)
docker volume prune -f
docker network prune -f

# volver a levantar
docker compose up -d --build
npm run migration:run
npm run start:api
```

---

## 10) Escala a 1M+ registros — Índices y Particionamiento

Objetivo: mantener p95 estable con 1M+ registros (Properties, 2M+ Listings, 1.5M+ Transactions) en PostgreSQL 14+ con PostGIS.

### Estrategia general

- **Patrones de consulta**: filtros por `tenantId`, `sector`, `type`, `price`, `createdAt`, `address ILIKE`, y geofiltros (radio) con KNN opcional.
- **Paginación**: cursor por `id` (evita OFFSET alto). Mantener `id` monótono (UUID v7 recomendado en producción).
- **Selección de columnas**: evitar devolver geometría/GeoJSON salvo cuando sea necesario (ya aplicado en el código).

### Plan de índices (SQL sugerido)

- Tabela `properties`:

  ```sql
  -- Filtro principal por tenant + columnas de alta selectividad
  CREATE INDEX IF NOT EXISTS ix_properties_tenant_sector_type_price
    ON properties (tenant_id, sector, type, price);

  -- Búsqueda por dirección (ILIKE) via expresión normalizada
  CREATE INDEX IF NOT EXISTS ix_properties_tenant_address_lower
    ON properties (tenant_id, lower(address));

  -- Consultas geo (radio + KNN)
  CREATE INDEX IF NOT EXISTS ix_properties_location_gist
    ON properties USING GIST (location);

  -- Ordenamientos recientes (created_at)
  CREATE INDEX IF NOT EXISTS ix_properties_tenant_created_at
    ON properties (tenant_id, created_at DESC);
  ```

- Tabela `listings`:

  ```sql
  CREATE INDEX IF NOT EXISTS ix_listings_tenant_status_price
    ON listings (tenant_id, status, price);

  CREATE INDEX IF NOT EXISTS ix_listings_property_id
    ON listings (property_id);

  -- Parcial para activos (reduce bloat cuando status=active es el hot path)
  CREATE INDEX IF NOT EXISTS ix_listings_active_partial
    ON listings (tenant_id, price)
    WHERE status = 'active';
  ```

- Tabela `transactions`:

  ```sql
  CREATE INDEX IF NOT EXISTS ix_tx_tenant_date
    ON transactions (tenant_id, date DESC);

  CREATE INDEX IF NOT EXISTS ix_tx_tenant_price
    ON transactions (tenant_id, price);

  CREATE INDEX IF NOT EXISTS ix_tx_property_id
    ON transactions (property_id);
  CREATE INDEX IF NOT EXISTS ix_tx_listing_id
    ON transactions (listing_id);
  ```

Observaciones:

- Use `INCLUDE` (covering) para colunas de projeção frequente (PG14+):
  ```sql
  CREATE INDEX IF NOT EXISTS ix_properties_tenant_sector_type_price_inc
    ON properties (tenant_id, sector, type, price)
    INCLUDE (address);
  ```
- Revisá planes de ejecución (`EXPLAIN (ANALYZE, BUFFERS)`) y ajustá selectividad.

### Particionamiento (cuándo adoptar)

- **Transactions**: partición por _range_ de `date` (mensual) y _subpartición_ por `tenant_id` (LIST) en escenarios multi‑tenant con alto volumen.
  - Beneficios: prune por rango temporal, mantenimiento (VACUUM/REINDEX) por partición, retención por ventana.
  - Esqueleto:

    ```sql
    -- Tabla particionada por RANGE (date)
    CREATE TABLE IF NOT EXISTS transactions_p (
      LIKE transactions INCLUDING ALL
    ) PARTITION BY RANGE (date);

    -- Particiones mensuales (ejemplo)
    CREATE TABLE IF NOT EXISTS transactions_2025_08
      PARTITION OF transactions_p FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
    ```

  - Alternativa: particionar directamente `transactions` desde el inicio (rompe migraciones futuras).

- **Properties/Listings**: generalmente no necesitan partición hasta decenas de millones.
  - Opciones: LIST por `tenant_id` (si hay pocos tenants muy grandes) o HASH por `tenant_id` (balanceo uniforme).

### Mantenimiento y parámetros

- **Autovacuum**: garantizar agresividad suficiente en tablas calientes (ajustar `autovacuum_vacuum_scale_factor`, `analyze_scale_factor` y `naptime` por tabla).
- **Fillfactor**: para tablas con updates frecuentes, reducir bloat.
- **Work_mem/Shared_buffers**: dimensionar según hardware y concurrencia.
- **Connection pooling**: mantener pool por worker (TypeORM) bajo control para no exceder `max_connections`.

### Buenas prácticas de consulta

- Usar parámetros tipados (evita SQL injection y mejora planes).
- Evitar `SELECT *`; proyectar columnas mínimas.
- Evitar `OFFSET` alto (usar cursor por `id`).
- Calcular distancia/GeoJSON solo cuando se solicite (ya aplicado).

### Validación

- Crear notebooks/queries de validación con:
  - `EXPLAIN (ANALYZE, BUFFERS)` para los 5 caminos críticos.
  - Benchmarks con carga sostenida (autocannon) antes/después de cada índice.
  - Observabilidad (métricas de latencia p95/p99) para confirmar mejora.

---

## 11) Licencia

MIT
