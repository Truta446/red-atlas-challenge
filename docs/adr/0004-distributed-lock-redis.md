# ADR 0004: Distributed Lock — Redis SET NX PX

- Status: Accepted
- Date: 2025-08-16

## Context

Import batches for the same job must be serialized across workers to avoid write conflicts.

## Decision

Implement a Redis-based lock utility using `SET key value NX PX ttl` and safe release (Lua script comparing token).

## Rationale

- Simplicity and performance for short-lived critical sections.
- Avoids heavyweight coordination systems.
- Works across multiple worker instances.

## Consequences

- Requires Redis availability; fallback path in consumer when Redis is down.
- Lock expiration must be tuned to batch duration; renewals may be added if needed.
- Tests and ADR document the safety and limitations vs. Redlock.
