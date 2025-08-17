# ADR 0008: Analytics and Audit Logging

- Status: Accepted
- Date: 2025-08-17

## Context
Stakeholders require aggregated insights and traceability of changes to critical resources.

## Decision
Implement an `AnalyticsModule` for distribution/percentiles/YoY calculations and an `AuditInterceptor` + `AuditService` for persistent audit trail.

## Rationale
- Keeps analytics concerns isolated from CRUD flows.
- Interceptor-based auditing provides consistent coverage with low coupling.

## Consequences
- Analytics queries must be optimized (indexes, partitions).
- Audit persistence must be resilient; failures are logged but do not break the main flow.
