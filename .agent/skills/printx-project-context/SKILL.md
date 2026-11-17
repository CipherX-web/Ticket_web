---
name: printx-project-context
description: Core context for the Print X platform (print shop, event ticketing, animated wedding invitations). Use at the start of any task in this repo to align with scope, stack, brand, roles and definition of done.
---

# Print X – Project Context
Source of truth: `docs/PrintX_Visual_Master_Plan.md` (companions: `PrintX_SRS_v1.md`, `PrintX_PostgreSQL_Schema_v1.sql` if present). Read the plan before large changes.

## Scope
One website (`printxads.lk`, Sri Lanka, LKR), three experiences: Print shop, Event ticketing (guest checkout, no account), Animated wedding invitations. One staff admin system.

## Stack
Next.js + TypeScript + Tailwind; NestJS modular monolith; PostgreSQL (migrations, constraints, transactions); Redis + job queue; private S3-compatible storage with short-lived signed URLs; hosted payment gateway; Argon2id + mandatory staff MFA.

## Modules / DB domains
identity, commerce, organizers, events, ticketing, payments, ledger, settlements, invitations, notifications, audit.

## Brand
ivory `#F7F5EF`, sage `#8FAF9E`, forest `#334B45`, gold `#D1B58A`. Whitespace, confident type, gentle motion, accessible contrast.

## Priorities
- Must before launch: authorization, safe payments, no overselling, reliable ticket issuance, organizer liabilities, backups, accessibility basics.
- Important: production status tracking, template previews, guest recovery, analytics, operator search.
- Later: organizer self-service, seat maps, automated refunds, CRM, native apps.

## Roadmap phases
0 Discovery → 1 Foundation → 2 Print commerce → 3 Ticketing & finance → 4 Invitation studio → 5 Launch hardening. Do not build ahead of the current phase without asking.

## Definition of done
Screen, API, validation, permissions, migration, automated tests, failure cases, audit/monitoring events, user docs. Live payments also need provider verification and finance sign-off.
