"use client";
import { useEffect, useState } from "react";
import {
  type AdminAttendee,
  type AdminEvent,
  checkInAttendee,
  fetchAdminAttendees,
  fetchAdminEvents,
} from "@/lib/admin-api";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/Button";
import { AdminModal, StatusBadge, ToastBanner } from "../AdminUi";

export default function AdminAttendeesPage() {
  const [attendees, setAttendees] = useState<AdminAttendee[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" }>({ msg: "", type: "success" });

  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<AdminAttendee | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [att, evts] = await Promise.all([fetchAdminAttendees(), fetchAdminEvents()]);
      setAttendees(att);
      setEvents(evts);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to load attendees.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = attendees.filter((a) => {
    if (eventFilter && a.booking.event.id !== eventFilter) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        a.code.toLowerCase().includes(q) ||
        a.booking.reference.toLowerCase().includes(q) ||
        a.booking.buyerName.toLowerCase().includes(q) ||
        a.booking.buyerEmail.toLowerCase().includes(q) ||
        a.booking.buyerWhatsapp.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleCheckIn(a: AdminAttendee) {
    try {
      await checkInAttendee(a.id);
      setToast({ msg: `Checked in ${a.booking.buyerName} (${a.code}).`, type: "success" });
      setSelected(null);
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Check-in failed.", type: "error" });
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <ToastBanner message={toast.msg} type={toast.type} onDismiss={() => setToast({ msg: "", type: "success" })} />

      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-line bg-paper p-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ticket code, name, email…"
          className="w-64 rounded-sm border border-line bg-ivory px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="rounded-sm border border-line bg-ivory px-3 py-2 text-sm">
          <option value="">All Events</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-sm border border-line bg-ivory px-3 py-2 text-sm">
          <option value="">All Ticket Statuses</option>
          <option value="VALID">Valid (Not Checked In)</option>
          <option value="CHECKED_IN">Checked In</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="rounded-sm border border-line bg-paper overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-sage-soft/60 text-xs font-medium uppercase text-muted">
            <tr>
              <th className="p-4">Ticket Code</th>
              <th className="p-4">Attendee</th>
              <th className="p-4">Event</th>
              <th className="p-4">Category</th>
              <th className="p-4">Booking</th>
              <th className="p-4">Check-in</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!loading &&
              filtered.map((a) => (
                <tr key={a.id} className="hover:bg-ivory/50">
                  <td className="p-4 font-mono text-xs font-semibold text-forest">{a.code}</td>
                  <td className="p-4">
                    <div className="font-medium text-forest">{a.booking.buyerName}</div>
                    <div className="text-xs text-muted">{a.booking.buyerEmail} · {a.booking.buyerWhatsapp}</div>
                  </td>
                  <td className="p-4 text-muted">{a.booking.event.title}</td>
                  <td className="p-4 text-xs">{a.tier.name}</td>
                  <td className="p-4">
                    <div className="font-mono text-xs text-forest">{a.booking.reference}</div>
                    <StatusBadge status={a.booking.status} />
                  </td>
                  <td className="p-4">
                    <StatusBadge status={a.status} />
                    {a.checkedInAt && (
                      <div className="mt-1 text-[11px] text-muted">{formatDate(a.checkedInAt)}</div>
                    )}
                  </td>
                  <td className="p-4 text-right space-x-3 whitespace-nowrap">
                    <button type="button" onClick={() => setSelected(a)} className="text-xs font-medium text-forest hover:underline">
                      View
                    </button>
                    {a.status === "VALID" && a.booking.status === "CONFIRMED" && (
                      <button type="button" onClick={() => handleCheckIn(a)} className="text-xs font-medium text-accent hover:underline">
                        Check In
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted">No attendees found.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={7} className="p-8 text-center text-muted">Loading attendees…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <AdminModal title={`Ticket ${selected.code}`} onClose={() => setSelected(null)}>
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-2 text-xs border-b border-line pb-4">
              <dt className="text-muted">Attendee</dt><dd className="font-medium text-forest">{selected.booking.buyerName}</dd>
              <dt className="text-muted">Email</dt><dd>{selected.booking.buyerEmail}</dd>
              <dt className="text-muted">WhatsApp</dt><dd>{selected.booking.buyerWhatsapp}</dd>
              <dt className="text-muted">Event</dt><dd>{selected.booking.event.title}</dd>
              <dt className="text-muted">Category</dt><dd>{selected.tier.name} ({selected.tier.code})</dd>
              <dt className="text-muted">Booking Ref</dt><dd className="font-mono">{selected.booking.reference}</dd>
              <dt className="text-muted">Booking Status</dt><dd><StatusBadge status={selected.booking.status} /></dd>
              <dt className="text-muted">Ticket Status</dt><dd><StatusBadge status={selected.status} /></dd>
            </dl>
            <div className="flex justify-between">
              {selected.status === "VALID" && selected.booking.status === "CONFIRMED" ? (
                <Button onClick={() => handleCheckIn(selected)}>Mark Checked In</Button>
              ) : <div />}
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
