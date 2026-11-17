"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  { href: "/print", label: "Print" },
  { href: "/events", label: "Events" },
  { href: "/invitations", label: "Invitations" },
  { href: "/track", label: "Track order" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ivory/95 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-xl tracking-[0.18em] text-forest" onClick={() => setOpen(false)}>
          PRINT <span className="text-gold">X</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
              className={`text-sm tracking-wide ${active(n.href) ? "text-forest underline decoration-gold decoration-2 underline-offset-8" : "text-muted hover:text-forest"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <button type="button" className="p-2 md:hidden" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="text-forest">
            {open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
          </svg>
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-ivory md:hidden">
          <ul className="container-x py-2">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} onClick={() => setOpen(false)} className="block border-b border-line/70 py-3 text-forest">{n.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
