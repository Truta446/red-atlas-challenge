# ADR 0010: Seeding and Partitioning Strategy

- Status: Accepted
- Date: 2025-08-17

## Context

We need large realistic datasets for development and performance testing (100k+ properties, 200k listings, 150k transactions) and a path to scale to 1M+ with sustained query performance.

## Decision

- Provide an idempotent seed script that can load massive data quickly both locally and in Docker.
- Apply composite and partial indexes to support core filters.
- Plan monthly partitioning for `transactions` to keep indexes and scans small at scale.

## Rationale

- Idempotent seed enables reproducible environments and CI smoke runs.
- Composite/partial indexes match access patterns (tenant, sector, type, price, created_at) and avoid scanning soft-deleted rows.
- Time-based partitioning is a natural fit for append-heavy `transactions` with time-bounded queries.

## Consequences

- Seeds run with compiled JS in Docker (`dist/scripts/seed.js`).
- Partition maintenance and index strategy must be documented/migrated ahead of growth.
- Query planner benefits from targeted indexes; writes must consider index overhead.
