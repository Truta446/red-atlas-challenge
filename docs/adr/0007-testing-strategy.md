# ADR 0007: Testing Strategy — Unit, Controller, E2E (Controller-Only)

- Status: Accepted
- Date: 2025-08-17

## Context
We target >80% coverage, fast feedback loops locally and in CI, and deterministic tests.

## Decision
- Unit tests for services, guards, interceptors, DTO validation.
- Controller tests with `@nestjs/testing` and SuperTest-based e2e (controller-only) using overrides/mocks.
- Avoid external dependencies (DB/Redis/RMQ) in tests; e2e focus in-process controllers.

## Rationale
- Fast and deterministic runs; no Docker required for tests.
- High coverage across validation, auth, metrics, analytics, imports pipeline logic.
- Simpler CI pipeline.

## Consequences
- Full system e2e with infra can be added separately if needed.
- Mocks must mirror contracts; keep them close to actual services.
