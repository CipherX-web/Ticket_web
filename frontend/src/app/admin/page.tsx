"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  type AdminBooking,
  type AdminEvent,
  type AdminPayment,
  fetchAdminBookings,
  fetchAdminEvents,
  fetchAllPayments,
} from "@/lib/admin-api";
import { formatDate, formatLkr } from "@/lib/format";
import { StatCard, StatusBadge } from "./AdminUi";

export default function AdminDashboardPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetchAdminEvents(),
      fetchAdminBookings(),
      fetchAllPayments().then((r) => r.items),
    ])
      .then(([evts, bks, pays]) => {
        setEvents(evts);
        setBookings(bks);
        setPayments(pays);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted">Loading live dashboard metrics…</div>;
  }

  if (error) {
    return <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-danger">{error}</div>;
  }

  const now = new Date();
  const publishedEvents = events.filter((e) => e.isPublished);
  const upcomingEvents = events.filter((e) => new Date(e.startsAt) > now);

  const totalCapacity = events.reduce((sum, e) => sum + e.tiers.reduce((s, t) => s + t.capacity, 0), 0);
  const availableTickets = events.reduce((sum, e) => sum + e.tiers.reduce((s, t) => s + t.available, 0), 0);
  const soldTickets = totalCapacity - availableTickets;

  const capturedPayments = payments.filter((p) => p.status === "CAPTURED");
  const totalRevenueMinor = capturedPayments.reduce((sum, p) => sum + p.amountMinor, 0);

  const recentBookings = bookings.slice(0, 6);

  return (
    <div className="space-y-8 max-w-7xl">
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatLkr(totalRevenueMinor)}
          hint={`${capturedPayments.length} successful payment${capturedPayments.length === 1 ? "" : "s"}`}
          accent
        />
        <StatCard
          label="Tickets Sold"
          value={soldTickets}
          hint={`${availableTickets} remaining of ${totalCapacity}`}
        />
        <StatCard
          label="Total Bookings"
          value={bookings.length}
          hint={`${bookings.filter((b) => b.status === "CONFIRMED").length} confirmed`}
        />
        <StatCard
          label="Events"
          value={events.length}
          hint={`${publishedEvents.length} published · ${upcomingEvents.length} upcoming`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-sm border border-line bg-paper p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="font-display text-lg text-forest">Event Performance</h2>
            <Link href="/admin/events" className="text-xs font-medium text-accent hover:underline">
              Manage Events →
            </Link>
          </div>
          <div className="space-y-4">
            {events.map((evt) => {
              const cap = evt.tiers.reduce((s, t) => s + t.capacity, 0);
              const avail = evt.tiers.reduce((s, t) => s + t.available, 0);
              const sold = cap - avail;
              const pct = cap > 0 ? Math.round((sold / cap) * 100) : 0;
              return (
                <div key={evt.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate font-medium text-forest">{evt.title}</span>
                      <StatusBadge status={evt.isPublished ? "PUBLISHED" : "DRAFT"} />
                    </div>
                    <span className="font-mono text-xs text-muted shrink-0">
                      {sold}/{cap} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-sage-soft">
                    <div className="h-full bg-accent transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
            {events.length === 0 && <p className="text-sm text-muted">No events found.</p>}
          </div>
        </section>

        <section className="rounded-sm border border-line bg-paper p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="font-display text-lg text-forest">Upcoming Events</h2>
            <Link href="/admin/categories" className="text-xs font-medium text-accent hover:underline">
              Ticket Categories →
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {upcomingEvents.slice(0, 5).map((evt) => {
              const avail = evt.tiers.reduce((s, t) => s + t.available, 0);
              return (
                <li key={evt.id} className="flex items-center justify-between py-3 gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-forest">{evt.title}</p>
                    <p className="truncate text-xs text-muted">
                      {formatDate(evt.startsAt)} · {evt.venue}, {evt.city}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs text-forest">{avail} left</p>
                    <StatusBadge status={evt.isPublished ? "PUBLISHED" : "DRAFT"} />
                  </div>
                </li>
              );
            })}
            {upcomingEvents.length === 0 && (
              <li className="py-6 text-center text-sm text-muted">No upcoming events scheduled.</li>
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-sm border border-line bg-paper p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 className="font-display text-lg text-forest">Recent Bookings</h2>
          <Link href="/admin/bookings" className="text-xs font-medium text-accent hover:underline">
            View All Bookings →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs font-medium uppercase text-muted">
              <tr>
                <th className="py-2.5 pr-4">Reference</th>
                <th className="py-2.5 pr-4">Customer</th>
                <th className="py-2.5 pr-4">Event</th>
                <th className="py-2.5 pr-4">Tickets</th>
                <th className="py-2.5 pr-4">Total</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recentBookings.map((b) => (
                <tr key={b.id} className="hover:bg-ivory/60">
                  <td className="py-3 pr-4 font-mono text-xs font-semibold text-forest">{b.reference}</td>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-forest">{b.buyerName}</div>
                    <div className="text-xs text-muted">{b.buyerEmail}</div>
                  </td>
                  <td className="py-3 pr-4 text-muted">{b.event.title}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{b.tickets.length}</td>
                  <td className="py-3 pr-4 font-medium text-forest">{formatLkr(b.totalMinor)}</td>
                  <td className="py-3 pr-4"><StatusBadge status={b.status} /></td>
                  <td className="py-3 text-xs text-muted">{formatDate(b.createdAt)}</td>
                </tr>
              ))}
              {recentBookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">No bookings recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
