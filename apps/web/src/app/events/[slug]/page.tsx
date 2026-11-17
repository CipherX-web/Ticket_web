import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { events, getEvent } from "@/data/events";
import { formatDate } from "@/lib/format";
import { Placeholder } from "@/components/Placeholder";
import { TicketPicker } from "./TicketPicker";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return events.map((e) => ({ slug: e.slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = getEvent((await params).slug);
  return { title: e ? e.title : "Event" };
}

export default async function EventPage({ params }: Props) {
  const event = getEvent((await params).slug);
  if (!event) notFound();
  return (
    <div className="container-x py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link className="hover:text-forest" href="/events">Events</Link> / <span className="text-forest">{event.title}</span>
      </nav>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <Placeholder src="/temp/event.svg" label={`${event.title} — event image`} className="aspect-[16/9]" />
          <h1 className="mt-6 font-display text-4xl text-forest">{event.title}</h1>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex gap-3"><dt className="w-20 text-muted">When</dt><dd>{formatDate(event.date)}</dd></div>
            <div className="flex gap-3"><dt className="w-20 text-muted">Where</dt><dd>{event.venue}, {event.city}</dd></div>
            <div className="flex gap-3"><dt className="w-20 text-muted">Organizer</dt><dd>{event.organizer}</dd></div>
          </dl>
          <p className="mt-5 max-w-prose text-muted">{event.summary}</p>
        </div>
        <TicketPicker event={event} />
      </div>
    </div>
  );
}
