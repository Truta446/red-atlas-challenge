# ADR 0006: Caching, Metrics, and Logging

- Status: Accepted
- Date: 2025-08-17

## Context
Performance SLOs and observability goals require caching, metrics, and structured logs.

## Decision
- Redis cache for selected GET endpoints with TTL and invalidation strategy.
- Prometheus metrics via `prom-client` and `/metrics` endpoint (protected).
- Structured JSON logs with `nestjs-pino`, correlation ID.

## Rationale
- Cache reduces DB pressure for hot reads.
- Metrics enable SLI/SLO tracking; counters/histograms for HTTP and imports pipeline.
- JSON logs support centralized ingestion/search and tracing via correlation ID.

## Consequences
- Cache consistency requires explicit invalidation on writes.
- Metrics registry lifecycles must be handled in tests (clear registry).
- Logging adds minimal overhead but greatly improves debuggability.
