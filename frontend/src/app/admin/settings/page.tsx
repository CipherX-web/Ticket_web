"use client";
import { useEffect, useState } from "react";
import {
  type Organizer,
  createOrganizer,
  fetchDeadLetters,
  fetchOrganizers,
  flushNotifications,
  releaseExpiredHolds,
  updateOrganizer,
} from "@/lib/admin-api";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { AdminModal, StatusBadge, ToastBanner } from "../AdminUi";

export default function AdminSettingsPage() {
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [deadLetters, setDeadLetters] = useState<Array<{ id: string; channel: string; recipient: string; template: string; attempts: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" }>({ msg: "", type: "success" });

  // Add Organizer Modal
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [commissionPct, setCommissionPct] = useState("10");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [orgs, dl] = await Promise.all([fetchOrganizers(), fetchDeadLetters().catch(() => [])]);
      setOrganizers(orgs);
      setDeadLetters(dl);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to load settings.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAddOrganizer(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createOrganizer({
        name,
        contactEmail: email,
        contactPhone: phone,
        commissionBps: Math.round(Number(commissionPct) * 100),
        bankName,
        bankAccount,
      });
      setShowAdd(false);
      setName("");
      setEmail("");
      setPhone("");
      setBankName("");
      setBankAccount("");
      setToast({ msg: "Organizer added.", type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to add organizer.", type: "error" });
    }
  }

  async function handleToggleOrganizer(org: Organizer) {
    try {
      await updateOrganizer(org.id, { isActive: !org.isActive });
      setToast({ msg: `${org.name} is now ${org.isActive ? "inactive" : "active"}.`, type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to update organizer.", type: "error" });
    }
  }

  async function handleFlushOutbox() {
    try {
      const res = await flushNotifications();
      setToast({ msg: `Outbox flushed: ${res.processed} sent, ${res.failed} failed.`, type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to flush outbox.", type: "error" });
    }
  }

  async function handleReleaseHolds() {
    try {
      const res = await releaseExpiredHolds();
      setToast({ msg: `Released ${res.released} expired inventory hold(s).`, type: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to release holds.", type: "error" });
    }
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <ToastBanner message={toast.msg} type={toast.type} onDismiss={() => setToast({ msg: "", type: "success" })} />

      {/* Organizers Section */}
      <section className="rounded-sm border border-line bg-paper p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="font-display text-lg text-forest">Event Organizers</h2>
            <p className="text-xs text-muted">Manage organizer profiles, platform commission rates, and bank payout accounts.</p>
          </div>
          <Button onClick={() => setShowAdd(true)}>+ Add Organizer</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs font-medium uppercase text-muted">
              <tr>
                <th className="py-2.5 pr-4">Name</th>
                <th className="py-2.5 pr-4">Contact</th>
                <th className="py-2.5 pr-4">Commission</th>
                <th className="py-2.5 pr-4">Bank Account</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!loading &&
                organizers.map((org) => (
                  <tr key={org.id}>
                    <td className="py-3 pr-4 font-medium text-forest">{org.name}</td>
                    <td className="py-3 pr-4 text-xs text-muted">
                      <div>{org.contactEmail}</div>
                      <div>{org.contactPhone}</div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">{org.commissionBps / 100}%</td>
                    <td className="py-3 pr-4 text-xs text-muted">
                      {org.bankName ? `${org.bankName} · ${org.bankAccount}` : "Not set"}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={org.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    <td className="py-3 text-right">
                      <button type="button" onClick={() => handleToggleOrganizer(org)} className="text-xs text-muted underline hover:text-forest">
                        {org.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              {!loading && organizers.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-muted">No organizers configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* System Operations */}
      <section className="rounded-sm border border-line bg-paper p-5 space-y-4">
        <h2 className="font-display text-lg text-forest border-b border-line pb-3">System Operations & Queues</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-sm border border-line bg-ivory p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm text-forest">Notification Outbox Queue</p>
              <p className="text-xs text-muted">Runs automatically every minute. Dead-letter queue: {deadLetters.length}</p>
            </div>
            <Button variant="secondary" onClick={handleFlushOutbox} className="py-2 px-3 text-xs shrink-0">
              Flush Now
            </Button>
          </div>
          <div className="rounded-sm border border-line bg-ivory p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm text-forest">Expired Inventory Holds</p>
              <p className="text-xs text-muted">Runs automatically every 5 minutes to restore abandoned holds.</p>
            </div>
            <Button variant="secondary" onClick={handleReleaseHolds} className="py-2 px-3 text-xs shrink-0">
              Release Now
            </Button>
          </div>
        </div>
      </section>

      {showAdd && (
        <AdminModal title="Add Event Organizer" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAddOrganizer} className="space-y-4">
            <TextField label="Organizer Name" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
            <TextField label="Contact Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField label="Contact Phone" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <TextField label="Platform Commission (%)" name="commission" type="number" min="0" max="50" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} required />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Bank Name" name="bankName" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              <TextField label="Bank Account" name="bankAccount" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit">Add Organizer</Button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
