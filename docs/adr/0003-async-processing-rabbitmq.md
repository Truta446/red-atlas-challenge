# ADR 0003: Async Processing — RabbitMQ

- Status: Accepted
- Date: 2025-08-16

## Context

CSV imports are large and must not block API threads. We need backpressure, retries, and DLQ.

## Decision

Use RabbitMQ for queueing import jobs and a NestJS worker consumer.

## Rationale

- AMQP supports explicit acks, routing keys, dead-letter exchanges, backoff retries.
- Decouples API (publisher) from worker (consumer), improving resilience and throughput.
- NestJS Microservices adapter integrates naturally.

## Consequences

- Operate RabbitMQ in Docker Compose and CI.
- Manage topology (exchanges/queues/bindings) and DLQ policies.
- Observability via metrics and structured logs around consumer.
