"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type AdminEvent,
  type Organizer,
  createAdminEvent,
  fetchAdminEvents,
  fetchOrganizers,
  togglePublishEvent,
  updateAdminEvent,
} from "@/lib/admin-api";
import { formatDate, formatLkr } from "@/lib/format";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { AdminModal, StatusBadge, ToastBanner } from "../AdminUi";

function EventsContent() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" }>({ msg: "", type: "success" });

  // Filters & sorting
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");
  const [sortBy, setSortBy] = useState<"DATE" | "TITLE" | "SOLD">("DATE");

  // Modals
  const [showCreate, setShowCreate] = useState(searchParams.get("new") === "1");
  const [editing, setEditing] = useState<AdminEvent | null>(null);
  const [viewing, setViewing] = useState<AdminEvent | null>(null);

  // Create form
  const [cTitle, setCTitle] = useState("");
  const [cSlug, setCSlug] = useState("");
  const [cOrgId, setCOrgId] = useState("");
  const [cStartsAt, setCStartsAt] = useState("");
  const [cVenue, setCVenue] = useState("");
  const [cCity, setCCity] = useState("");
  const [cSummary, setCSummary] = useState("");
  const [cApproval, setCApproval] = useState<"AUTOMATIC" | "MANUAL" | "HYBRID">("AUTOMATIC");
  const [cPublish, setCPublish] = useState(false);
  const [cTierName, setCTierName] = useState("General Admission");
  const [cTierCode, setCTierCode] = useState("GA");
  const [cTierPrice, setCTierPrice] = useState("2500");
  const [cTierCap, setCTierCap] = useState("100");

  // Edit form
  const [eTitle, setETitle] = useState("");
  const [eStartsAt, setEStartsAt] = useState("");
  const [eVenue, setEVenue] = useState("");
  const [eCity, setECity] = useState("");
  const [eSummary, setESummary] = useState("");
  const [eApproval, setEApproval] = useState<"AUTOMATIC" | "MANUAL" | "HYBRID">("AUTOMATIC");
  const [ePublished, setEPublished] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [evts, orgs] = await Promise.all([fetchAdminEvents(), fetchOrganizers().catch(() => [])]);
      setEvents(evts);
      setOrganizers(orgs);
      if (orgs[0] && !cOrgId) setCOrgId(orgs[0].id);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to load events.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") setShowCreate(true);
  }, [searchParams]);

  function openEdit(evt: AdminEvent) {
    setEditing(evt);
    setETitle(evt.title);
    // Format ISO to datetime-local value (YYYY-MM-DDTHH:mm)
    const d = new Date(evt.startsAt);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEStartsAt(localIso);
    setEVenue(evt.venue);
    setECity(evt.city);
    setESummary(evt.summary);
    setEApproval(evt.approvalMode);
    setEPublished(evt.isPublished);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createAdminEvent({
        title: cTitle,
        slug: (cSlug || cTitle).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        organizerId: cOrgId || (organizers[0]?.id ?? ""),
        startsAt: new Date(cStartsAt).toISOString(),
        venue: cVenue,
        city: cCity,
        summary: cSummary,
        approvalMode: cApproval,
        isPublished: cPublish,
        tiers: [
          {
            name: cTierName,
            code: cTierCode,
            priceMinor: Math.round(Number(cTierPrice) * 100),
            capacity: Number(cTierCap),
            perOrderMax: 10,
          },
        ],
      });
      setShowCreate(false);
      setCTitle("");
      setCSlug("");
      setCVenue("");
      setCCity("");
      setCSummary("");
      setToast({ msg: "Event created successfully.", type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to create event.", type: "error" });
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await updateAdminEvent(editing.id, {
        title: eTitle,
        startsAt: new Date(eStartsAt).toISOString(),
        venue: eVenue,
        city: eCity,
        summary: eSummary,
        approvalMode: eApproval,
        isPublished: ePublished,
      });
      setEditing(null);
      setToast({ msg: "Event updated. User UI now reflects the latest details.", type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to update event.", type: "error" });
    }
  }

  async function handleTogglePublish(evt: AdminEvent) {
    try {
      await togglePublishEvent(evt.id, !evt.isPublished);
      setToast({
        msg: `"${evt.title}" is now ${evt.isPublished ? "unpublished (hidden from User UI)" : "published (live in User UI)"}.`,
        type: "success",
      });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Action failed.", type: "error" });
    }
  }

  const filtered = events
    .filter((evt) => {
      if (statusFilter === "PUBLISHED" && !evt.isPublished) return false;
      if (statusFilter === "DRAFT" && evt.isPublished) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          evt.title.toLowerCase().includes(q) ||
          evt.slug.toLowerCase().includes(q) ||
          evt.venue.toLowerCase().includes(q) ||
          evt.city.toLowerCase().includes(q) ||
          evt.organizer.name.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "TITLE") return a.title.localeCompare(b.title);
      if (sortBy === "SOLD") {
        const soldA = a.tiers.reduce((s, t) => s + (t.capacity - t.available), 0);
        const soldB = b.tiers.reduce((s, t) => s + (t.capacity - t.available), 0);
        return soldB - soldA;
      }
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });

  return (
    <div className="space-y-6 max-w-7xl">
      <ToastBanner message={toast.msg} type={toast.type} onDismiss={() => setToast({ msg: "", type: "success" })} />

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-sm border border-line bg-paper p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, venue, city…"
            className="w-64 rounded-sm border border-line bg-ivory px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-sm border border-line bg-ivory px-3 py-2 text-sm"
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft / Unpublished</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-sm border border-line bg-ivory px-3 py-2 text-sm"
            aria-label="Sort events"
          >
            <option value="DATE">Sort by Date</option>
            <option value="TITLE">Sort by Title</option>
            <option value="SOLD">Sort by Tickets Sold</option>
          </select>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Create Event</Button>
      </div>

      {/* Events Table */}
      <div className="rounded-sm border border-line bg-paper overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-sage-soft/60 text-xs font-medium uppercase text-muted">
            <tr>
              <th className="p-4">Event</th>
              <th className="p-4">Organizer</th>
              <th className="p-4">Date & Venue</th>
              <th className="p-4">Ticket Inventory</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!loading &&
              filtered.map((evt) => {
                const cap = evt.tiers.reduce((s, t) => s + t.capacity, 0);
                const avail = evt.tiers.reduce((s, t) => s + t.available, 0);
                const sold = cap - avail;
                return (
                  <tr key={evt.id} className="hover:bg-ivory/50">
                    <td className="p-4">
                      <p className="font-medium text-forest">{evt.title}</p>
                      <p className="font-mono text-xs text-muted">/{evt.slug}</p>
                    </td>
                    <td className="p-4 text-muted">{evt.organizer.name}</td>
                    <td className="p-4">
                      <div className="text-forest">{formatDate(evt.startsAt)}</div>
                      <div className="text-xs text-muted">
                        {evt.venue}, {evt.city}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-mono text-xs text-forest">
                        {sold} sold · {avail} left
                      </div>
                      <div className="text-xs text-muted">{evt.tiers.length} categories</div>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={evt.isPublished ? "PUBLISHED" : "DRAFT"} />
                    </td>
                    <td className="p-4 text-right space-x-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setViewing(evt)}
                        className="text-xs font-medium text-forest hover:underline"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(evt)}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(evt)}
                        className="text-xs text-muted hover:text-forest underline"
                      >
                        {evt.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      {evt.isPublished && (
                        <Link
                          href={`/events/${evt.slug}`}
                          target="_blank"
                          className="text-xs text-muted hover:text-forest"
                        >
                          Live ↗
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  No matching events found.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  Loading events…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <AdminModal title="Create New Event" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <TextField label="Event Title" name="title" value={cTitle} onChange={(e) => setCTitle(e.target.value)} required />
            <TextField label="URL Slug (optional)" name="slug" value={cSlug} placeholder="auto-generated-from-title" onChange={(e) => setCSlug(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-forest">Organizer</label>
              <select
                value={cOrgId}
                onChange={(e) => setCOrgId(e.target.value)}
                className="mt-2 block w-full border border-line bg-ivory px-3 py-3 text-sm"
                required
              >
                <option value="">Select organizer…</option>
                {organizers.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <TextField label="Date & Time" name="startsAt" type="datetime-local" value={cStartsAt} onChange={(e) => setCStartsAt(e.target.value)} required />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Venue" name="venue" value={cVenue} onChange={(e) => setCVenue(e.target.value)} required />
              <TextField label="City" name="city" value={cCity} onChange={(e) => setCCity(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-forest">Summary</label>
              <textarea
                value={cSummary}
                onChange={(e) => setCSummary(e.target.value)}
                rows={3}
                required
                className="mt-2 block w-full border border-line bg-ivory px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-forest">Approval Mode</label>
                <select value={cApproval} onChange={(e) => setCApproval(e.target.value as any)} className="mt-2 block w-full border border-line bg-ivory px-3 py-2.5 text-sm">
                  <option value="AUTOMATIC">Automatic</option>
                  <option value="MANUAL">Manual</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-forest cursor-pointer">
                  <input type="checkbox" checked={cPublish} onChange={(e) => setCPublish(e.target.checked)} />
                  Publish immediately
                </label>
              </div>
            </div>

            <div className="border-t border-line pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Initial Ticket Category</p>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Category Name" name="tierName" value={cTierName} onChange={(e) => setCTierName(e.target.value)} required />
                <TextField label="Code" name="tierCode" value={cTierCode} onChange={(e) => setCTierCode(e.target.value)} required />
                <TextField label="Price (LKR)" name="tierPrice" type="number" min="1" value={cTierPrice} onChange={(e) => setCTierPrice(e.target.value)} required />
                <TextField label="Capacity" name="tierCap" type="number" min="1" value={cTierCap} onChange={(e) => setCTierCap(e.target.value)} required />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit">Create Event</Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Edit Modal */}
      {editing && (
        <AdminModal title={`Edit Event · ${editing.title}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            <TextField label="Event Title" name="eTitle" value={eTitle} onChange={(e) => setETitle(e.target.value)} required />
            <TextField label="Date & Time" name="eStartsAt" type="datetime-local" value={eStartsAt} onChange={(e) => setEStartsAt(e.target.value)} required />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Venue" name="eVenue" value={eVenue} onChange={(e) => setEVenue(e.target.value)} required />
              <TextField label="City" name="eCity" value={eCity} onChange={(e) => setECity(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-forest">Summary</label>
              <textarea
                value={eSummary}
                onChange={(e) => setESummary(e.target.value)}
                rows={3}
                required
                className="mt-2 block w-full border border-line bg-ivory px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-forest">Approval Mode</label>
                <select value={eApproval} onChange={(e) => setEApproval(e.target.value as any)} className="mt-2 block w-full border border-line bg-ivory px-3 py-2.5 text-sm">
                  <option value="AUTOMATIC">Automatic</option>
                  <option value="MANUAL">Manual</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-forest cursor-pointer">
                  <input type="checkbox" checked={ePublished} onChange={(e) => setEPublished(e.target.checked)} />
                  Published on User UI
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Details Modal */}
      {viewing && (
        <AdminModal title={viewing.title} onClose={() => setViewing(null)}>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted">/{viewing.slug}</span>
              <StatusBadge status={viewing.isPublished ? "PUBLISHED" : "DRAFT"} />
            </div>
            <dl className="grid grid-cols-2 gap-2 border-y border-line py-3">
              <dt className="text-muted">Organizer</dt>
              <dd className="font-medium">{viewing.organizer.name}</dd>
              <dt className="text-muted">Starts At</dt>
              <dd>{formatDate(viewing.startsAt)}</dd>
              <dt className="text-muted">Location</dt>
              <dd>{viewing.venue}, {viewing.city}</dd>
              <dt className="text-muted">Approval Mode</dt>
              <dd>{viewing.approvalMode}</dd>
            </dl>
            <p className="text-muted">{viewing.summary}</p>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Ticket Categories</h3>
              <ul className="divide-y divide-line border border-line rounded-sm">
                {viewing.tiers.map((t) => (
                  <li key={t.id} className="flex items-center justify-between p-2.5 text-xs">
                    <div>
                      <span className="font-medium text-forest">{t.name}</span>{" "}
                      <span className="font-mono text-muted">({t.code})</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-forest">{formatLkr(t.priceMinor)}</span> ·{" "}
                      <span className="text-muted">{t.available}/{t.capacity} left</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-between pt-2">
              <Link href="/admin/categories" className="text-xs text-accent underline">
                Manage Ticket Categories →
              </Link>
              <Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

export default function AdminEventsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted">Loading events…</div>}>
      <EventsContent />
    </Suspense>
  );
}
