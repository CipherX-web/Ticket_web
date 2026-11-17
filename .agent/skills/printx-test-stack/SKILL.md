---
name: printx-test-stack
description: Test stack and commands for Print X: Vitest/Jest, React Testing Library, Testcontainers, Playwright, k6, axe, Lighthouse CI, security scanners, GitHub Actions. Use when writing or running tests and CI.
---

# Test Stack
- Unit: Vitest (frontend/shared), Jest (NestJS). Property tests: fast-check (settlement/ledger, pricing).
- Components: React Testing Library + user-event; Storybook for design system/studio panels.
- Integration/API: Jest + Supertest with Testcontainers (real PostgreSQL + Redis); test migrations, constraints, RBAC denials, queue retries.
- E2E: Playwright (desktop + mobile viewports): guest checkout, print order→proof approval, invitation open/RSVP, QR check-in.
- Concurrency/load: k6 (last-ticket x100, webhook replay storm).
- Payments: gateway sandbox + signed webhook fixtures.
- A11y: axe-core via Playwright + manual keyboard pass. Performance: Lighthouse CI (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1).
- Security: ESLint security plugin, Semgrep, gitleaks, `npm audit`, Trivy, OWASP ZAP baseline against staging.
- Static: TypeScript strict, ESLint, Prettier. CI: GitHub Actions running all of the above on each PR; red build blocks merge.
- Required abuse tests: IDOR, privilege escalation, replayed webhook, duplicate scan, expired/reused OTP, oversized/malicious upload, XSS payloads in names/RSVP notes, SQLi strings, rate-limit enforcement.
