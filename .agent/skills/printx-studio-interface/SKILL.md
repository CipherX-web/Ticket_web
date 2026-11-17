---
name: printx-studio-interface
description: Studio-style interface for Print X: the visual workspace UI for the invitation studio and product/artwork customizer (canvas, panels, timeline, live preview). Use when building studio, editor, or configurator screens.
---

# Studio Interface
"Studio" = a professional editor-like workspace, used by invitation operators (and a lighter version for print customers).

## Layout
Top bar (project name, save status, undo/redo, preview, publish) · Left rail (templates, scenes, assets, guests) · Centre canvas with device frames (mobile/tablet/desktop toggle) · Right inspector (properties for selected scene/element: text, colours, fonts, media, animation) · Bottom timeline/scene strip (reorder scenes, per-scene scroll/animation settings).

## Invitation studio features
- Pick versioned theme + scene sequence; edit couple/event data; live preview with scroll-animation scrubber and reduced-motion preview.
- Guest panel: CSV/Excel import with validation report, bulk-generate private tokens, per-guest preview ("view as guest"), resend/expire/rotate, RSVP stats.
- Draft → preview → publish with version history and rollback; autosave.
- Asset manager: upload images with size/format checks, compression, lazy-load budgets shown to operator (warn on heavy assets).

## Print customizer (customer side)
Canvas/preview of product with size, material, finish controls; artwork upload with bleed/safe-area guides, resolution warnings, price updating live; proof approval step.

## UX/tech rules
- Keyboard shortcuts, focus management, ARIA for panels; works on tablet; panels collapsible.
- State in a typed store (e.g. Zustand) with a serializable template config schema; validate with Zod; server re-validates and enforces RBAC (invitation operator only).
- Never trust client-side data; autosave uses optimistic concurrency (version number).
- Preview renders the same scene components used in production.
