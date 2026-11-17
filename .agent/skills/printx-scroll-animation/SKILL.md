---
name: printx-scroll-animation
description: Scroll-driven animation and motion rules for Print X (reveal, parallax, pinned scenes, smooth scroll) with performance and reduced-motion requirements. Use when adding any scroll effect or animated section.
---

# Scroll Animation Standards
## Tooling
GSAP + ScrollTrigger (or Motion `useScroll`/`whileInView`); optional Lenis smooth scroll. Register plugins once in a client-only provider; clean up with `gsap.context()` / `ctx.revert()` on unmount. Prefer CSS scroll-driven animation or IntersectionObserver for simple reveals.

## Patterns
- Reveal on scroll: fade + 16–32px translate, 0.5–0.8s, ease `power3.out`, stagger 0.06–0.12s; play once.
- Parallax: images move 5–15% relative to container, `transform` only.
- Pinned storytelling scenes (invitation scenes, "how it works"): `ScrollTrigger` with `pin`, `scrub: true|0.5`, a single timeline per scene; keep pinned length ≤ ~300vh.
- Marquee/logos, number counters (once when in view), horizontal gallery strips, hero text split-line reveal.
- Hover: subtle scale ≤1.03, underline/colour shift; never required to use a feature.

## Rules
- Animate only `transform` and `opacity`; no layout properties; use `will-change` sparingly.
- Respect `prefers-reduced-motion`: disable parallax/pin/scrub, show content immediately (static final state).
- No content hidden before JS runs for SEO-critical text (SSR visible, animate from a safe state); avoid CLS.
- Lazy-load heavy scenes (`dynamic import`), no autoplay video as default on mobile, ScrollTrigger `refresh` after images load.
- Mobile budget: ~60 FPS on mid-range phones; test throttled CPU; fewer pinned scenes on small screens (`matchMedia`).
- Keyboard and screen-reader access unaffected; no scroll-jacking that traps users; keep native scroll with Lenis only if it passes accessibility checks.
- Ensure LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 with animations on.
