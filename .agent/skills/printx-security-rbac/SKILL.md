---
name: printx-security-rbac
description: Security, authentication and RBAC rules for Print X. Use when writing auth, endpoints, permissions, file handling, tokens, or anything touching personal data.
---

# Security & RBAC
- Every operation is permission-checked **on the server** and scoped to the resource; hiding UI is never authorization.
- Staff: Argon2id, mandatory MFA, secure sessions. Audit every sensitive action (immutable audit log; super admin cannot bypass).
- Roles: super admin, shop manager, print staff, event manager, finance staff, invitation operator, check-in operator. Apply least privilege (e.g. print staff cannot see payouts; check-in operator cannot see full customer/payment data; shop manager cannot falsify payments; event manager cannot modify finalized ledger).
- No public database endpoint; TLS; encryption at rest; secrets only via env/secret manager, never committed.
- Uploads: private storage, expiring signed URLs, type/size limits, malware scan.
- Tokens (QR, invitation links): long, random, high-entropy; never sequential or guessable; support revoke/rotate.
- Guest booking recovery: verified email OTP, never booking reference alone.
- Validate all input with typed schemas; rate-limit public and OTP endpoints.
- Privacy: retention rules, deletion/export workflow; log without PII/secrets.
