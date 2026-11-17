---
name: printx-reference-ui
description: UI reference patterns for Print X drawn from lsprinting.lk (print shop) and thirdeye.web.lk (photo studio). Use when designing public pages, home, service/portfolio sections, or contact/footer.
---

# Reference UI: lsprinting.lk + thirdeye.web.lk
> Caveat: the sites could not be opened in a browser (Chrome remote debugging unavailable); structure below comes from web-search summaries only. Visual details (exact colors, fonts, effects) are NOT verified. Re-inspect both sites when a browser is available and update this file. Do not copy their assets, text or branding; use as structural inspiration only. Print X keeps its own brand palette.

## lsprinting.lk (print shop – trust & clarity)
Header with logo + nav (Home, About, Services/Products, Portfolio, Contact) → hero with value proposition and motto-style tagline → about/story, vision & mission (support Sinhala + English) → service categories (tutes/notes, offset, packaging/labels/stickers, corporate items) → previous-works gallery of real photos → footer with address, phone, WhatsApp, email, socials, map.
Take-aways: lead with credibility, show real finished jobs, WhatsApp as a primary CTA, bilingual-ready (Sinhala/English; Tamil later), bulk/institutional jobs highlighted.

## thirdeye.web.lk (photo studio – visual portfolio)
Studio site with `/en` locale path: photography (wedding, portrait, event), colour lab & printing, framing, supplies. Visual, portfolio-led, contact details prominent.
Take-aways: locale-prefixed routes (`/en`, `/si`, `/ta`), image-first sections per service, gallery/portfolio, clear contact block.

## Print X application
- Home: hero → three service tiles (Print, Tickets, Invitations) → featured products → recent work gallery → how it works → trust/contact/WhatsApp → footer.
- Locale routing `/en`, `/si`, `/ta`; use Unicode-safe fonts (Noto Sans Sinhala/Tamil).
- Persistent WhatsApp CTA with order/product reference.
- Real photography with responsive images (`next/image`), alt text, lazy loading.
