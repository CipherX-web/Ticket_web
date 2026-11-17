---
name: printx-ticketing-payments-ledger
description: Rules for event ticketing, payments, QR tickets, ledger and organizer settlements in Print X. Use when touching holds, checkout, webhooks, ticket issuance, refunds, or payouts.
---

# Ticketing, Payments & Ledger
## Booking
- Guest checkout, no account: collect only name, email, WhatsApp, event/billing details.
- Flow: choose tier/qty → short inventory hold → details + payment → verify → atomic ticket issue + QR → email/WhatsApp via queue.
- Never oversell: time-limited holds, DB transactions, atomic inventory constraints. Test 100 concurrent attempts on last ticket.

## Payments
- Hosted gateway only. Verify signed callbacks server-side; handle idempotently (replayed webhook = no duplicate tickets/ledger posts). Use transactional outbox + retry/dead-letter queues.
- Bank transfer: staff reconciliation against real bank credits; slips alone are not proof.
- Approval modes per event: automatic, manual, hybrid.
- Failed/pending payments go to an exception queue.

## Ledger & settlements
- Immutable double-entry-style journal. Never edit a summary balance; derive from entries; corrections are reversing entries.
- Payout = gross captured − refunds/chargebacks − Print X commission − contractually assigned fees. Tax/fee allocation specified separately.
- Every payout reconciles to journal entries and requires finance approval.
- Model explicit state machines for payment, ticket, settlement; document transitions.

## Check-in
- Random QR verification tokens, server-side duplicate-scan prevention, minimal scanner privileges, audit every entry decision.

## Gate
Do not enable live ticket payments until written gateway/bank permission for third-party organizer funds and legal/tax review are confirmed.
