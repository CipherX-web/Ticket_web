---
name: printx-print-shop
description: Print shop domain rules for Print X: catalog, price calculator, artwork upload, quotes, proofs and production queue. Use when working on commerce/print features.
---

# Print Shop
- Journey: discover → customize → upload/WhatsApp → quote or pay → proof approval → production → pickup/delivery.
- Catalog with filters, specs; calculator by size (w/h), quantity, material, finishing; price rules managed by staff; unusual jobs go to staff quotation.
- Upload guidance: format, dimensions, resolution, bleed. WhatsApp inquiry includes order reference.
- Saved cart, guest checkout, delivery/pickup costs, order tracking.
- Production states: `new → artwork review → awaiting proof approval → ready to print → printing → ready → delivered`. Enforce transitions server-side.
- **Never start an irreversible print job before customer proof approval** where a proof is required; store approved version + timestamp.
- Artwork in private storage, signed expiring URLs.
