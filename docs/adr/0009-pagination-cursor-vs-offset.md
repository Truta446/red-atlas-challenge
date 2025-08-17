# ADR 0009: Pagination — Cursor vs Offset

- Status: Accepted
- Date: 2025-08-17

## Context

The API lists large datasets with frequent writes. Offset pagination degrades with large offsets and suffers from inconsistent pages on concurrent writes.

## Decision

Use cursor-based pagination for all list endpoints.

## Rationale

- Stable ordering under concurrent inserts/updates.
- Efficient query plans avoiding deep OFFSET scans.
- Smaller payloads and cleaner “next page” semantics.

## Consequences

- Requires deterministic sort fields and an encoded cursor.
- Client must pass the cursor returned by the previous page.
