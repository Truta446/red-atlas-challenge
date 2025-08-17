# ADR 0012: Security and Rate Limiting

- Status: Accepted
- Date: 2025-08-17

## Context

Public API endpoints must be protected against abuse and common web risks while preserving performance (compression, caching) and developer ergonomics.

## Decision

- Apply sane security headers and CORS configuration.
- Keep CSRF protection enabled where applicable; JWT used for API auth.
- Enable gzip compression with a conservative threshold (10kB) to balance CPU vs bandwidth.
- Introduce token bucket–style rate limiting at the gateway/API level (configurable per route/tenant when applicable).

## Rationale

- Security headers and strict CORS reduce attack surface.
- CSRF remains relevant for cookie-based contexts; explicit decision to keep it on.
- Compression improves payload transfer time; threshold avoids small-payload overhead.
- Rate limiting protects against brute-force and abuse without heavy infra.

## Consequences

- Some endpoints may need exceptions (e.g., file uploads) for compression or size limits.
- Rate limits must be communicated (429 responses) and tuned; consider per-tenant keys.
- Monitoring required to adjust thresholds without harming legitimate workloads.
