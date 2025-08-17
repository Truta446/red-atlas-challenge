# ADR 0002: Database and ORM — PostgreSQL + PostGIS with TypeORM

- Status: Accepted
- Date: 2025-08-15

## Context

Spatial queries, strong relational integrity, and mature ecosystem were required. We also needed migrations, seeding, and good TypeScript integration.

## Decision

Use PostgreSQL 14+ with PostGIS for geo features and TypeORM as the ORM.

## Rationale

- PostGIS provides native geospatial types/functions (GiST/GiN indexes, KNN <->).
- PostgreSQL supports extensions used (citext, pgcrypto), partial indexes, partitioning.
- TypeORM has solid Nest integration, migrations, CLI, repository pattern, data-source config.

## Consequences

- Leverage geo queries and KNN sorting efficiently.
- Need to manage migrations and performance (indices, pool, partial indexes) explicitly.
- Seeds implemented via scripts (`dist/scripts/seed.js`) for Docker compatibility.
