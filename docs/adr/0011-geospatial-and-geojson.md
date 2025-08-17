# ADR 0011: Geospatial Queries and GeoJSON Responses

- Status: Accepted
- Date: 2025-08-17

## Context

The domain requires location-based search, sorting by proximity, and interoperable geodata in API responses.

## Decision

- Store geometry in PostGIS and index with GiST on `location::geography`.
- Use KNN (`<->`) for nearest-neighbor sorting when `sortBy=distance`.
- Expose geometry as GeoJSON in responses using `ST_AsGeoJSON`.

## Rationale

- GiST on geography enables efficient distance filtering and KNN ordering.
- Distance computations are only performed when explicitly requested to avoid overhead.
- GeoJSON is widely supported by mapping libraries and data tools.

## Consequences

- Ensure SRID consistency and explicit casts to geography where needed.
- Add composable filters (sector/type/price/date/address) and limit selected columns for performance.
- Tests should verify KNN ordering and GeoJSON structure.
