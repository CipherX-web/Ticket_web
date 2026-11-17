"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  { href: "/events", label: "Events" },
  { href: "/print", label: "Print Shop" },
  { href: "/studio", label: "Studio" },
  { href: "/invitations", label: "Invitations" },
  { href: "/track", label: "Track Order" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <header className="sticky top-0 z-40 border-b border-studio-line bg-studio/95 text-white backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-display text-xl tracking-[0.18em] text-white" onClick={() => setOpen(false)}>
          <span className="inline-block h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          PRINT <span className="text-gold">X</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`text-sm tracking-wide transition-colors ${
                active(n.href)
                  ? "text-white underline decoration-accent decoration-2 underline-offset-8"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/studio"
            className="rounded-sm border border-studio-line bg-studio-panel px-3.5 py-1.5 text-xs font-medium uppercase tracking-widest text-white/90 transition-colors hover:border-accent hover:text-white"
          >
            Open Studio
          </Link>
        </div>
        <button type="button" className="p-2 md:hidden" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="text-white">
            {open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
          </svg>
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-studio-line bg-studio md:hidden">
          <ul className="container-x py-2">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} onClick={() => setOpen(false)} className="block border-b border-studio-line/70 py-3 text-white/90 hover:text-white">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
