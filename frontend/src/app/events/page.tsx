import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { events } from "@/data/events";
import { formatDate, formatLkr } from "@/lib/format";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <>
      <PageHeader eyebrow="Event tickets" title="Upcoming events">Buy tickets as a guest — no account required. Tickets arrive by email and WhatsApp with a QR code.</PageHeader>
      <div className="container-x py-12">
        <ul className="divide-y divide-line border-y border-line">
          {events.map((e) => {
            const from = Math.min(...e.tiers.map((t) => t.priceMinor));
            const soldOut = e.tiers.every((t) => t.available === 0);
            return (
              <li key={e.slug}>
                <Link href={`/events/${e.slug}`} className="grid gap-2 py-6 transition-colors hover:bg-paper md:grid-cols-[1fr_auto] md:items-center md:px-4">
                  <div>
                    <h2 className="font-display text-2xl text-forest">{e.title}</h2>
                    <p className="mt-1 text-sm text-muted">{formatDate(e.date)} · {e.venue}, {e.city}</p>
                    <p className="mt-1 text-xs uppercase tracking-widest text-forest/60">By {e.organizer}</p>
                  </div>
                  <p className="text-sm text-forest">{soldOut ? "Sold out" : `From ${formatLkr(from)}`}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
