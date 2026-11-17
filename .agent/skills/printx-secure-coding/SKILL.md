---
name: printx-secure-coding
description: High-security coding standard for Print X based on OWASP Top 10 / ASVS: auth, sessions, injection, XSS, CSRF, SSRF, uploads, secrets, headers, rate limiting, logging, dependencies, infrastructure. Use for ALL code that handles input, auth, data, files, payments or deployment.
---

# Secure Coding Standard (assume attackers; vibe-coded apps fail here)
Treat OWASP Top 10 and ASVS L2 as the baseline (L3 for payments/ledger/admin). Do a mini threat model (STRIDE: who, what asset, how abused) for every feature.

## Authentication & sessions
- Staff: Argon2id (memory ≥19 MiB, tuned), mandatory MFA (TOTP/WebAuthn), lockout/backoff, no user enumeration in messages, secure password reset with single-use short-lived tokens.
- Sessions: server-side or short JWT + rotating refresh; cookies `HttpOnly; Secure; SameSite=Lax/Strict`, `__Host-` prefix; rotate on login/privilege change; idle + absolute timeout; revoke on logout/password change.
- Guest OTP: 6+ digits, hashed at rest, 5–10 min expiry, attempt limits, per-IP and per-email throttling.

## Authorization
- Deny by default. Central guards/policies; check role AND resource ownership/scope on every request (prevents IDOR/BOLA). Never trust client-sent IDs, prices, roles, totals; recompute server-side.
- Tests for every endpoint: unauthenticated, wrong role, wrong tenant/resource.

## Input & output
- Validate with strict schemas (reject unknown fields, max lengths, types, ranges). Parameterized queries/ORM only; never string-built SQL; no `eval`/dynamic `require`.
- Output encoding: rely on React escaping; never `dangerouslySetInnerHTML` unless sanitized (DOMPurify) with justification. Sanitize filenames; prevent path traversal.
- CSRF: SameSite cookies + CSRF tokens/Origin check on state-changing cookie-auth requests. CORS: explicit allowlist, no `*` with credentials.
- SSRF: no user-controlled server fetches; if needed, allowlist + block private IP ranges.
- Open redirects: allowlist redirect targets. Mass assignment: map DTO fields explicitly.

## Uploads & files
Private bucket, random object keys, MIME sniffing + extension allowlist, size caps, image re-encode/strip EXIF, antivirus scan before use, signed short-lived URLs (≤5 min), `Content-Disposition: attachment`, never serve from app origin executable types.

## Payments & webhooks
Hosted gateway (no card data touches servers; PCI SAQ-A). Verify webhook signature over raw body, timestamp tolerance, idempotency, amount/currency/order match; confirm with gateway API when possible. Never mark paid from the browser redirect.

## Tokens & crypto
CSPRNG (`crypto.randomBytes(32)`), store only hash of secret tokens where possible, constant-time compare, HMAC-signed QR payloads with server-side state, no custom crypto, TLS 1.2+/HSTS, encrypt sensitive columns (PII like phone/bank details) with KMS-managed keys.

## Web hardening
Headers: strict CSP (nonce-based, no `unsafe-inline`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors ''none''`, COOP/CORP. Rate limit all public endpoints (login, OTP, checkout, RSVP, hold creation), bot protection on forms (Turnstile/hCaptcha is for real users—integrate, don''t bypass). Generic error pages; no stack traces; disable source maps publicly.

## Secrets & config
Env/secret manager only; `.env*` in `.gitignore`; secret scanning (gitleaks) in CI and pre-commit; separate keys per environment; rotate on leak; least-privilege DB users (app user cannot DROP/ALTER; separate migration user); no public DB endpoint; private networking.

## Supply chain
Lockfile, exact/audited versions, `npm audit`/Dependabot/Renovate, minimal dependencies, `--ignore-scripts` in CI where possible, SBOM, verify packages before adding (typosquatting), pin CI actions by SHA.

## Logging, audit, monitoring
Structured logs with request IDs; never log passwords, tokens, OTPs, card data, full PII; immutable audit log for auth, permission changes, payments, refunds, payouts, exports, check-in decisions; alerts on auth anomalies, failed webhooks/queues, 5xx spikes.

## Infrastructure & ops
WAF/CDN, DDoS limits, firewall default deny, containers non-root with read-only FS, patched base images, scanned images (Trivy), IaC reviewed, encrypted backups + restore drills, staging separate from prod, least-privilege cloud IAM, MFA for all admin consoles, incident response and breach-notification runbook (Sri Lanka PDPA obligations).

## Pre-merge security checklist
[ ] Threat model noted [ ] AuthN/AuthZ + IDOR tests [ ] Input schemas [ ] No secrets in repo [ ] Rate limits [ ] Headers/CSP intact [ ] Uploads safe [ ] Webhooks verified & idempotent [ ] Audit events [ ] Dependency audit clean [ ] Error messages generic [ ] Tests for abuse cases.
