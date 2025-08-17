# ADR 0001: Framework Choice — NestJS

- Status: Accepted
- Date: 2025-08-15

## Context

We needed a backend capable of rapid development with strong modularity, first-class TypeScript, DI, guards/interceptors, and a mature ecosystem for testing and documentation.

## Decision

Use NestJS over a minimalist Express setup.

## Rationale

- Opinionated architecture with modules/services/controllers improves maintainability.
- Powerful DI, guards (Auth/Role), interceptors (metrics/audit), pipes/filters.
- `@nestjs/swagger` integration for API docs at `/docs`.
- `@nestjs/microservices` for RabbitMQ workers.
- Excellent testing utilities with Jest and `@nestjs/testing`.

## Consequences

- Slightly higher abstraction than raw Express, but productivity and consistency outweigh.
- Aligns well with observability and test coverage goals.
