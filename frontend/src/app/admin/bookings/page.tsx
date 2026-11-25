"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  type AdminBooking,
  type AdminEvent,
  cancelAdminBooking,
  fetchAdminBookings,
  fetchAdminEvents,
} from "@/lib/admin-api";
import { formatDate, formatLkr } from "@/lib/format";
import { Button } from "@/components/Button";
import { AdminModal, StatusBadge, ToastBanner } from "../AdminUi";

function BookingsContent() {
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" }>({ msg: "", type: "success" });

  // Filters
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [selected, setSelected] = useState<AdminBooking | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [bks, evts] = await Promise.all([fetchAdminBookings(), fetchAdminEvents()]);
      setBookings(bks);
      setEvents(evts);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to load bookings.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setQuery(q);
  }, [searchParams]);

  const filtered = bookings.filter((b) => {
    if (eventFilter && b.eventId !== eventFilter) return false;
    if (statusFilter && b.status !== statusFilter) return false;
    const payStatus = b.payments[0]?.status ?? "PENDING";
    if (paymentFilter && payStatus !== paymentFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        b.reference.toLowerCase().includes(q) ||
        b.buyerName.toLowerCase().includes(q) ||
        b.buyerEmail.toLowerCase().includes(q) ||
        b.buyerWhatsapp.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleCancel(b: AdminBooking) {
    if (!confirm(`Cancel booking ${b.reference} for ${b.buyerName}? This will release ${b.tickets.length} ticket(s) back to inventory.`)) {
      return;
    }
    try {
      await cancelAdminBooking(b.id);
      setSelected(null);
      setToast({ msg: `Booking ${b.reference} cancelled and inventory restored.`, type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to cancel booking.", type: "error" });
    }
  }

  function csvCell(val: string | number): string {
    const str = String(val ?? "");
    const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    const header = ["Reference", "Customer", "Email", "WhatsApp", "Event", "Tickets", "Total LKR", "Booking Status", "Payment Status", "Date"];
    const lines = filtered.map((b) => [
      csvCell(b.reference),
      csvCell(b.buyerName),
      csvCell(b.buyerEmail),
      csvCell(b.buyerWhatsapp),
      csvCell(b.event.title),
      b.tickets.length,
      (b.totalMinor / 100).toFixed(2),
      csvCell(b.status),
      csvCell(b.payments[0]?.status ?? "NONE"),
      csvCell(b.createdAt),
    ]);
    const csv = [header.join(","), ...lines.map((l) => l.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `printx-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <ToastBanner message={toast.msg} type={toast.type} onDismiss={() => setToast({ msg: "", type: "success" })} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-sm border border-line bg-paper p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ref, name, email, phone…"
            className="w-60 rounded-sm border border-line bg-ivory px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="rounded-sm border border-line bg-ivory px-3 py-2 text-sm">
            <option value="">All Events</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-sm border border-line bg-ivory px-3 py-2 text-sm">
            <option value="">All Booking Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PENDING_PAYMENT">Pending Payment</option>
            <option value="PENDING_MANUAL_REVIEW">Manual Review</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="rounded-sm border border-line bg-ivory px-3 py-2 text-sm">
            <option value="">All Payment Statuses</option>
            <option value="CAPTURED">Captured</option>
            <option value="PENDING">Pending</option>
            <option value="MANUAL_REVIEW">Manual Review</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <Button variant="secondary" onClick={exportCsv} className="py-2 px-4 text-xs">
          Export CSV ({filtered.length})
        </Button>
      </div>

      <div className="rounded-sm border border-line bg-paper overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-sage-soft/60 text-xs font-medium uppercase text-muted">
            <tr>
              <th className="p-4">Booking Ref</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Event</th>
              <th className="p-4">Qty</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Booking</th>
              <th className="p-4">Payment</th>
              <th className="p-4">Date</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!loading &&
              filtered.map((b) => {
                const payStatus = b.payments[0]?.status ?? "PENDING";
                return (
                  <tr key={b.id} className="hover:bg-ivory/50">
                    <td className="p-4 font-mono text-xs font-semibold text-forest">{b.reference}</td>
                    <td className="p-4">
                      <div className="font-medium text-forest">{b.buyerName}</div>
                      <div className="text-xs text-muted">{b.buyerEmail}</div>
                    </td>
                    <td className="p-4 text-muted">{b.event.title}</td>
                    <td className="p-4 font-mono text-xs">{b.tickets.length}</td>
                    <td className="p-4 font-semibold text-forest">{formatLkr(b.totalMinor)}</td>
                    <td className="p-4"><StatusBadge status={b.status} /></td>
                    <td className="p-4"><StatusBadge status={payStatus} /></td>
                    <td className="p-4 text-xs text-muted">{formatDate(b.createdAt)}</td>
                    <td className="p-4 text-right space-x-3 whitespace-nowrap">
                      <button type="button" onClick={() => setSelected(b)} className="text-xs font-medium text-accent hover:underline">
                        View
                      </button>
                      {b.status !== "CANCELLED" && b.status !== "REFUNDED" && !b.tickets.some((t) => t.status === "CHECKED_IN") && (
                        <button type="button" onClick={() => handleCancel(b)} className="text-xs text-danger hover:underline">
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-muted">No bookings found.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={9} className="p-8 text-center text-muted">Loading bookings…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <AdminModal title={`Booking ${selected.reference}`} onClose={() => setSelected(null)} maxWidth="max-w-2xl">
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <p className="font-medium text-forest">{selected.event.title}</p>
                <p className="text-xs text-muted">{formatDate(selected.event.startsAt)} · {selected.event.venue}</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-muted">Customer Name</dt><dd className="font-medium">{selected.buyerName}</dd>
              <dt className="text-muted">Email</dt><dd>{selected.buyerEmail}</dd>
              <dt className="text-muted">WhatsApp</dt><dd>{selected.buyerWhatsapp}</dd>
              <dt className="text-muted">Total Amount</dt><dd className="font-semibold text-forest">{formatLkr(selected.totalMinor)}</dd>
              <dt className="text-muted">Created</dt><dd>{formatDate(selected.createdAt)}</dd>
            </dl>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Issued Tickets ({selected.tickets.length})</h3>
              <ul className="divide-y divide-line border border-line rounded-sm">
                {selected.tickets.map((t) => (
                  <li key={t.id} className="flex items-center justify-between p-2.5 text-xs">
                    <div>
                      <span className="font-mono font-semibold text-forest">{t.code}</span> · {t.tier.name}
                    </div>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Payments</h3>
              <ul className="divide-y divide-line border border-line rounded-sm">
                {selected.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between p-2.5 text-xs">
                    <div>
                      <span className="font-medium">{p.method.replace(/_/g, " ")}</span> · {formatLkr(p.amountMinor)}
                      {p.providerRef && <span className="ml-2 font-mono text-muted">Ref: {p.providerRef}</span>}
                    </div>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-between pt-2">
              {selected.status !== "CANCELLED" && selected.status !== "REFUNDED" && !selected.tickets.some((t) => t.status === "CHECKED_IN") ? (
                <Button variant="secondary" onClick={() => handleCancel(selected)} className="border-danger text-danger hover:bg-danger hover:text-white">
                  Cancel Booking
                </Button>
              ) : <div />}
              <Button onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

export default function AdminBookingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted">Loading bookings…</div>}>
      <BookingsContent />
    </Suspense>
  );
}
