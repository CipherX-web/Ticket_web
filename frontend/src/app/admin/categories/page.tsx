"use client";
import { useEffect, useState } from "react";
import {
  type AdminEvent,
  type AdminTier,
  addEventTier,
  deleteEventTier,
  fetchAdminEvents,
  updateEventTier,
} from "@/lib/admin-api";
import { formatLkr } from "@/lib/format";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { AdminModal, ToastBanner } from "../AdminUi";

export default function AdminCategoriesPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState("");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" }>({ msg: "", type: "success" });

  // Add Modal
  const [showAdd, setShowAdd] = useState(false);
  const [addEventId, setAddEventId] = useState("");
  const [addName, setAddName] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addCap, setAddCap] = useState("");
  const [addMax, setAddMax] = useState("6");

  // Edit Modal
  const [editing, setEditing] = useState<(AdminTier & { eventTitle: string }) | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCap, setEditCap] = useState("");
  const [editMax, setEditMax] = useState("");

  async function load() {
    setLoading(true);
    try {
      const evts = await fetchAdminEvents();
      setEvents(evts);
      if (evts[0] && !addEventId) setAddEventId(evts[0].id);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to load categories.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = events.flatMap((evt) =>
    evt.tiers.map((t) => ({ ...t, eventTitle: evt.title, isPublished: evt.isPublished })),
  );

  const filtered = rows.filter((r) => {
    if (eventFilter && r.eventId !== eventFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.eventTitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addEventTier(addEventId, {
        name: addName,
        code: addCode,
        priceMinor: Math.round(Number(addPrice) * 100),
        capacity: Number(addCap),
        perOrderMax: Number(addMax),
      });
      setShowAdd(false);
      setAddName("");
      setAddCode("");
      setAddPrice("");
      setAddCap("");
      setToast({ msg: "Ticket category added. It is now live on the event.", type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to add category.", type: "error" });
    }
  }

  function openEdit(t: AdminTier & { eventTitle: string }) {
    setEditing(t);
    setEditName(t.name);
    setEditPrice(String(t.priceMinor / 100));
    setEditCap(String(t.capacity));
    setEditMax(String(t.perOrderMax));
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await updateEventTier(editing.id, {
        name: editName,
        priceMinor: Math.round(Number(editPrice) * 100),
        capacity: Number(editCap),
        perOrderMax: Number(editMax),
      });
      setEditing(null);
      setToast({ msg: "Ticket category updated. Prices & availability synced to User UI.", type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to update category.", type: "error" });
    }
  }

  async function handleDelete(t: AdminTier & { eventTitle: string }) {
    if (!confirm(`Delete category "${t.name}" from "${t.eventTitle}"?`)) return;
    try {
      await deleteEventTier(t.id);
      setToast({ msg: `Deleted "${t.name}".`, type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Cannot delete category.", type: "error" });
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <ToastBanner message={toast.msg} type={toast.type} onDismiss={() => setToast({ msg: "", type: "success" })} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-sm border border-line bg-paper p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search category or code…"
            className="w-60 rounded-sm border border-line bg-ivory px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="rounded-sm border border-line bg-ivory px-3 py-2 text-sm"
            aria-label="Filter by event"
          >
            <option value="">All Events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Add Ticket Category</Button>
      </div>

      <div className="rounded-sm border border-line bg-paper overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-sage-soft/60 text-xs font-medium uppercase text-muted">
            <tr>
              <th className="p-4">Category</th>
              <th className="p-4">Event</th>
              <th className="p-4">Price</th>
              <th className="p-4">Sold / Capacity</th>
              <th className="p-4">Remaining</th>
              <th className="p-4">Order Limit</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!loading &&
              filtered.map((t) => {
                const sold = t.capacity - t.available;
                return (
                  <tr key={t.id} className="hover:bg-ivory/50">
                    <td className="p-4">
                      <p className="font-medium text-forest">{t.name}</p>
                      <p className="font-mono text-xs text-muted">{t.code}</p>
                    </td>
                    <td className="p-4 text-muted">{t.eventTitle}</td>
                    <td className="p-4 font-semibold text-forest">{formatLkr(t.priceMinor)}</td>
                    <td className="p-4 font-mono text-xs">{sold} / {t.capacity}</td>
                    <td className="p-4">
                      <span className={`font-mono text-xs font-semibold ${t.available === 0 ? "text-danger" : "text-emerald-700"}`}>
                        {t.available === 0 ? "SOLD OUT" : `${t.available} left`}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-muted">Max {t.perOrderMax} / order</td>
                    <td className="p-4 text-right space-x-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        Edit
                      </button>
                      {sold === 0 && (
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          className="text-xs text-danger hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">No ticket categories found.</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">Loading ticket categories…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Category Modal */}
      {showAdd && (
        <AdminModal title="Add Ticket Category" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-forest">Event</label>
              <select
                value={addEventId}
                onChange={(e) => setAddEventId(e.target.value)}
                className="mt-2 block w-full border border-line bg-ivory px-3 py-3 text-sm"
                required
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Category Name" name="name" value={addName} placeholder="e.g. VIP Table" onChange={(e) => setAddName(e.target.value)} required />
              <TextField label="Code" name="code" value={addCode} placeholder="e.g. VIP" onChange={(e) => setAddCode(e.target.value)} required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <TextField label="Price (LKR)" name="price" type="number" min="1" value={addPrice} onChange={(e) => setAddPrice(e.target.value)} required />
              <TextField label="Quantity" name="cap" type="number" min="1" value={addCap} onChange={(e) => setAddCap(e.target.value)} required />
              <TextField label="Max / Order" name="max" type="number" min="1" max="50" value={addMax} onChange={(e) => setAddMax(e.target.value)} required />
            </div>
            <div className="flex justify-end gap-3 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit">Add Category</Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Edit Category Modal */}
      {editing && (
        <AdminModal title={`Edit Category · ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            <p className="text-xs text-muted">
              Event: <span className="font-medium text-forest">{editing.eventTitle}</span> · Code:{" "}
              <span className="font-mono">{editing.code}</span>
            </p>
            <TextField label="Category Name" name="editName" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            <div className="grid grid-cols-3 gap-3">
              <TextField label="Price (LKR)" name="editPrice" type="number" min="1" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} required />
              <TextField label="Total Capacity" name="editCap" type="number" min={editing.capacity - editing.available} value={editCap} onChange={(e) => setEditCap(e.target.value)} required />
              <TextField label="Max / Order" name="editMax" type="number" min="1" max="50" value={editMax} onChange={(e) => setEditMax(e.target.value)} required />
            </div>
            <p className="text-xs text-muted">
              Already sold/held: {editing.capacity - editing.available}. Remaining availability will update automatically.
            </p>
            <div className="flex justify-end gap-3 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit">Save Category</Button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
