"use client";
import { useEffect, useState } from "react";
import {
  type AdminBooking,
  type AdminEvent,
  type AdminPayment,
  type Settlement,
  approveSettlement,
  calculateSettlement,
  fetchAdminBookings,
  fetchAdminEvents,
  fetchAllPayments,
  fetchSettlements,
  markSettlementPaid,
} from "@/lib/admin-api";
import { formatLkr } from "@/lib/format";
import { Button } from "@/components/Button";
import { AdminModal, StatCard, StatusBadge, ToastBanner } from "../AdminUi";

export default function AdminReportsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" }>({ msg: "", type: "success" });

  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftEventId, setDraftEventId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [evts, bks, pays, sets] = await Promise.all([
        fetchAdminEvents(),
        fetchAdminBookings(),
        fetchAllPayments().then((r) => r.items),
        fetchSettlements().catch(() => []),
      ]);
      setEvents(evts);
      setBookings(bks);
      setPayments(pays);
      setSettlements(sets);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to load reports.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted">Calculating live analytics from system data…</div>;
  }

  const confirmedBookings = bookings.filter((b) => b.status === "CONFIRMED");
  const grossRevenueMinor = confirmedBookings.reduce((s, b) => s + b.totalMinor, 0);

  // Per-event revenue & sales
  const eventStats = events.map((evt) => {
    const evtBookings = confirmedBookings.filter((b) => b.eventId === evt.id);
    const revenue = evtBookings.reduce((s, b) => s + b.totalMinor, 0);
    const sold = evt.tiers.reduce((s, t) => s + (t.capacity - t.available), 0);
    const capacity = evt.tiers.reduce((s, t) => s + t.capacity, 0);
    return { evt, revenue, sold, capacity, bookingCount: evtBookings.length };
  });

  const maxRevenue = Math.max(1, ...eventStats.map((x) => x.revenue));

  // Payment status counts
  const paymentCounts = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    const evt = events.find((x) => x.id === draftEventId);
    if (!evt) return;
    try {
      await calculateSettlement({ eventId: evt.id, organizerId: evt.organizerId });
      setShowDraftModal(false);
      setToast({ msg: `Settlement drafted for "${evt.title}".`, type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Could not calculate settlement.", type: "error" });
    }
  }

  async function handleApprove(id: string) {
    if (!confirm("Approve this settlement payout from immutable ledger records?")) return;
    try {
      await approveSettlement(id);
      setToast({ msg: "Settlement approved.", type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Approval failed.", type: "error" });
    }
  }

  async function handleMarkPaid(id: string) {
    if (!confirm("Mark this settlement as PAID after completing bank transfer?")) return;
    try {
      await markSettlementPaid(id);
      setToast({ msg: "Settlement marked as PAID.", type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Action failed.", type: "error" });
    }
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <ToastBanner message={toast.msg} type={toast.type} onDismiss={() => setToast({ msg: "", type: "success" })} />

      {/* Top Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Confirmed Revenue" value={formatLkr(grossRevenueMinor)} accent />
        <StatCard label="Confirmed Bookings" value={confirmedBookings.length} />
        <StatCard label="Captured Payments" value={paymentCounts.CAPTURED ?? 0} />
        <StatCard label="Pending / Review" value={(paymentCounts.PENDING ?? 0) + (paymentCounts.MANUAL_REVIEW ?? 0)} />
      </div>

      {/* Revenue & Sales by Event */}
      <section className="rounded-sm border border-line bg-paper p-5 space-y-4">
        <h2 className="font-display text-lg text-forest border-b border-line pb-3">Event Sales & Revenue Comparison</h2>
        <div className="space-y-4">
          {eventStats.map(({ evt, revenue, sold, capacity, bookingCount }) => {
            const widthPct = Math.round((revenue / maxRevenue) * 100);
            return (
              <div key={evt.id} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-forest">{evt.title}</span>
                  <span className="font-mono text-xs text-muted">
                    {bookingCount} orders · {sold}/{capacity} tickets ·{" "}
                    <strong className="text-forest">{formatLkr(revenue)}</strong>
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-sm bg-sage-soft">
                  <div className="h-full bg-forest" style={{ width: `${Math.max(2, widthPct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sales by Ticket Category */}
      <section className="rounded-sm border border-line bg-paper p-5 space-y-4">
        <h2 className="font-display text-lg text-forest border-b border-line pb-3">Sales by Ticket Category</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs font-medium uppercase text-muted">
              <tr>
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Price</th>
                <th className="py-2 pr-4">Sold</th>
                <th className="py-2 pr-4">Remaining</th>
                <th className="py-2">Est. Gross</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.flatMap((evt) =>
                evt.tiers.map((t) => {
                  const sold = t.capacity - t.available;
                  return (
                    <tr key={t.id}>
                      <td className="py-2.5 pr-4 text-muted">{evt.title}</td>
                      <td className="py-2.5 pr-4 font-medium text-forest">{t.name}</td>
                      <td className="py-2.5 pr-4">{formatLkr(t.priceMinor)}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{sold}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{t.available}</td>
                      <td className="py-2.5 font-semibold text-forest">{formatLkr(sold * t.priceMinor)}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Organizer Settlements */}
      <section className="rounded-sm border border-line bg-paper p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="font-display text-lg text-forest">Organizer Settlements (Immutable Ledger)</h2>
            <p className="text-xs text-muted">Compute payouts from confirmed ledger entries and track approvals.</p>
          </div>
          <Button onClick={() => setShowDraftModal(true)}>+ Draft Settlement</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs font-medium uppercase text-muted">
              <tr>
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Organizer</th>
                <th className="py-2 pr-4">Gross</th>
                <th className="py-2 pr-4">Commission</th>
                <th className="py-2 pr-4">Net Payable</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {settlements.map((s) => (
                <tr key={s.id}>
                  <td className="py-3 pr-4 font-medium text-forest">{s.event.title}</td>
                  <td className="py-3 pr-4 text-muted">{s.organizer.name}</td>
                  <td className="py-3 pr-4">{formatLkr(s.grossMinor)}</td>
                  <td className="py-3 pr-4 text-muted">{formatLkr(s.commissionMinor)}</td>
                  <td className="py-3 pr-4 font-semibold text-forest">{formatLkr(s.netPayableMinor)}</td>
                  <td className="py-3 pr-4"><StatusBadge status={s.status} /></td>
                  <td className="py-3 text-right space-x-3">
                    {s.status === "DRAFT" && (
                      <button type="button" onClick={() => handleApprove(s.id)} className="text-xs font-medium text-accent hover:underline">
                        Approve
                      </button>
                    )}
                    {s.status === "APPROVED" && (
                      <button type="button" onClick={() => handleMarkPaid(s.id)} className="text-xs font-medium text-emerald-700 hover:underline">
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {settlements.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-muted">No settlements drafted yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showDraftModal && (
        <AdminModal title="Calculate Event Settlement" onClose={() => setShowDraftModal(false)}>
          <form onSubmit={handleCalculate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-forest">Select Event</label>
              <select
                value={draftEventId}
                onChange={(e) => setDraftEventId(e.target.value)}
                className="mt-2 block w-full border border-line bg-ivory px-3 py-3 text-sm"
                required
              >
                <option value="">Choose an event…</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.title} ({e.organizer.name})</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowDraftModal(false)}>Cancel</Button>
              <Button type="submit">Calculate from Ledger</Button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
