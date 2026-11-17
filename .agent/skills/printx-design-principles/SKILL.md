---
name: printx-design-principles
description: Software design principles and patterns for Print X (SOLID, DDD-lite modular monolith, clean architecture, state machines, outbox, idempotency). Use when designing modules, services, APIs, or database structures.
---

# Design Principles & Patterns
## Principles
SOLID; DRY without premature abstraction; KISS/YAGNI; separation of concerns; high cohesion/low coupling; fail fast; make illegal states unrepresentable; composition over inheritance; least privilege; secure by default.

## Architecture
- NestJS modular monolith; one module per domain (identity, commerce, organizers, events, ticketing, payments, ledger, settlements, invitations, notifications, audit). Modules talk through public service interfaces or domain events, never by reaching into another module''s tables.
- Layers per module: controller (transport, validation, authz) → application service (use-case, transaction boundary) → domain (entities, rules, state machines) → repository/infrastructure (DB, gateway, storage). Dependencies point inward; domain has no framework imports.
- Frontend: feature folders, server components by default, thin client components, typed API client generated from contracts, design-system primitives separate from feature UI.

## Patterns to use
- **State machine** for order, payment, ticket, settlement, proof (explicit transitions, guards, audit on each).
- **Repository** + **Unit of Work** (transaction per use case).
- **Transactional outbox** + queue workers (retries, backoff, dead-letter) for email/WhatsApp/webhooks.
- **Idempotency keys** for payments, webhooks, ticket issue, ledger posting (unique constraints).
- **Strategy** for pricing rules, approval modes, notification channels. **Adapter/Anti-corruption layer** for payment gateway, WhatsApp, email, storage.
- **Immutable event/ledger journal** with reversing entries; **CQRS-lite** for reports (read models).
- **DTO + schema validation** at every boundary (Zod/class-validator), mapped to domain types; never expose DB entities.
- **Feature flags** for risky launches; **Result/typed errors** and a global error filter returning safe messages.

## Database
3NF baseline, FKs, `CHECK`, `UNIQUE`, `NOT NULL`, enums/state tables; money as integer minor units (or NUMERIC) with currency, never float; UTC timestamps; soft-delete only where needed; row-level concurrency via transactions, `SELECT … FOR UPDATE` or atomic conditional updates; indexes for every FK/query path; migrations reviewed.

## API
REST with versioning (`/v1`), consistent error shape, pagination limits, idempotent POST via `Idempotency-Key`, no sensitive data in URLs, OpenAPI documented.

## Anti-patterns to avoid
God services, business logic in controllers/components, shared mutable global state, trusting client values (price, role, quantity), stringly-typed states, catch-and-ignore, N+1 queries, copy-paste auth checks (use guards/policies).
