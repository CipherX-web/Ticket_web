---
name: printx-testing-definition-of-done
description: Testing and definition-of-done checklist for Print X. Use before finishing any feature or reviewing a change.
---

# Testing & Done Checklist
A feature is done only with: screen, API, validation, permissions, DB migration, automated tests, failure cases, audit/monitoring events, user docs.

Required tests where relevant:
- Ticket concurrency (no overselling), webhook replay (no duplicates), OTP recovery isolation, settlement-to-journal reconciliation, invitation batch uniqueness, RBAC denial cases.
- Ops: encrypted backups, tested restore, alerts for failed queues/callbacks.
Report what was run and what was not.
