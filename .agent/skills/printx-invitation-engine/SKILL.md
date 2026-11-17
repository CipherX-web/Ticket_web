---
name: printx-invitation-engine
description: Animated wedding invitation engine for Print X: scene components, templates, guest tokens, CSV import, RSVP, performance and accessibility. Use for invitation features.
---

# Invitation Engine
- Invitations are real interactive pages, not static images/PDFs.
- Architecture: reusable scene components + versioned template config + event data + guest token.
- Animation with GSAP/Motion (envelope open, typography, transitions). Lazy-load later content; no large videos as default mobile asset; honor `prefers-reduced-motion` with an accessible fallback.
- Operator flow: create campaign → import CSV/Excel guests → bulk-generate private links → preview, publish, resend, expire, track RSVP.
- Guests see own name, couple details, countdown, gallery, venue/map, RSVP limited to their allocation.
- Tokens: long random, no names in URLs, revocable/rotatable. Links can be forwarded—minimize data exposed.
- Acceptance: 100+ guests yield unique tokens and correct personalization; smooth ~60 FPS where supported; mobile CWV targets below.
