# ADR 0005: Authentication — JWT with Refresh Rotation

- Status: Accepted
- Date: 2025-08-16

## Context

We need stateless auth with role-based access, multi-tenant enforcement, and support for refresh.

## Decision

Use access JWTs (short TTL) and refresh tokens with rotation; Nest guards for auth and roles.

## Rationale

- JWTs fit horizontally scaled API and Fastify/cluster mode.
- Nest guards (`AuthGuard`, `RolesGuard`) enforce tenant_id and roles per route.
- Rotation reduces reuse of stolen refresh tokens.

## Consequences

- Clock skew handling and token invalidation must be considered.
- Secure storage of refresh tokens (httpOnly) recommended for real deployments.
- Add endpoints for login/refresh/logout and DTO validations.
