---
name: printx-frontend-quality
description: Frontend design system, performance and accessibility standards for Print X. Use when building UI components or pages.
---

# Frontend Quality
- Next.js + TypeScript + Tailwind; reusable accessible components; tokens from brand palette (ivory #F7F5EF, sage #8FAF9E, forest #334B45, gold #D1B58A).
- Mobile first. Targets (p75): LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.
- WCAG-minded: contrast, keyboard nav, labels, focus states, reduced motion.
- Admin nav: Overview · Print Orders · Products · Events · Organizers · Ticket Check-in · Invitations · Payments · Settlements · Notifications · Reports · Staff & Access · Settings · Audit Logs (show only what role permits, but enforce server-side).
- Handle loading, empty, error states; asset budgets and lazy loading.
