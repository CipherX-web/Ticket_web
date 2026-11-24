"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  type StaffUser,
  type AdminEvent,
  type Organizer,
  type PendingReconciliation,
  type Settlement,
  staffLogin,
  staffLogout,
  fetchStaffMe,
  fetchAdminEvents,
  createAdminEvent,
  togglePublishEvent,
  fetchOrganizers,
  createOrganizer,
  fetchPendingReconciliations,
  reconcilePayment,
  fetchSettlements,
  calculateSettlement,
  approveSettlement,
} from "@/lib/api";
import { formatDate, formatLkr } from "@/lib/format";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";

export function AdminDashboard() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"events" | "organizers" | "reconciliation" | "settlements">("events");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Data states
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [reconciliations, setReconciliations] = useState<PendingReconciliation[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [feedback, setFeedback] = useState("");

  // Create Event Form
  const [showEventModal, setShowEventModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newOrgId, setNewOrgId] = useState("");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newVenue, setNewVenue] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newTierName, setNewTierName] = useState("Standard Pass");
  const [newTierCode, setNewTierCode] = useState("STD");
  const [newTierPrice, setNewTierPrice] = useState("2500");
  const [newTierCapacity, setNewTierCapacity] = useState("100");

  // Create Organizer Form
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgCommission, setOrgCommission] = useState("10");
  const [orgBankName, setOrgBankName] = useState("");
  const [orgBankAccount, setOrgBankAccount] = useState("");

  // Calculate Settlement Form
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settleEventId, setSettleEventId] = useState("");

  useEffect(() => {
    fetchStaffMe()
      .then((res) => {
        setUser(res.user);
        void loadData();
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function loadData() {
    try {
      const [evts, orgs, recs, sets] = await Promise.all([
        fetchAdminEvents().catch(() => []),
        fetchOrganizers().catch(() => []),
        fetchPendingReconciliations().catch(() => []),
        fetchSettlements().catch(() => []),
      ]);
      setEvents(evts);
      setOrganizers(orgs);
      setReconciliations(recs);
      setSettlements(sets);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr("");
    setLoggingIn(true);
    try {
      const res = await staffLogin({ email: loginEmail, password: loginPass });
      setUser(res.user);
      await loadData();
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await staffLogout();
    setUser(null);
  }

  async function handleTogglePublish(event: AdminEvent) {
    try {
      await togglePublishEvent(event.id, !event.isPublished);
      setFeedback(`Event "${event.title}" ${event.isPublished ? "unpublished" : "published"} successfully.`);
      await loadData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed to toggle status.");
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createAdminEvent({
        title: newTitle,
        slug: newSlug || newTitle.toLowerCase().replace(/\s+/g, "-"),
        organizerId: newOrgId || (organizers[0]?.id ?? ""),
        startsAt: new Date(newStartsAt).toISOString(),
        venue: newVenue,
        city: newCity,
        summary: newSummary,
        tiers: [
          {
            name: newTierName,
            code: newTierCode,
            priceMinor: Math.round(Number(newTierPrice) * 100),
            capacity: Number(newTierCapacity),
            perOrderMax: 10,
          },
        ],
      });
      setShowEventModal(false);
      setFeedback("New event created successfully!");
      await loadData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed to create event.");
    }
  }

  async function handleCreateOrganizer(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createOrganizer({
        name: orgName,
        contactEmail: orgEmail,
        contactPhone: orgPhone,
        commissionBps: Math.round(Number(orgCommission) * 100),
        bankName: orgBankName,
        bankAccount: orgBankAccount,
      });
      setShowOrgModal(false);
      setFeedback("Organizer created successfully!");
      await loadData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed to create organizer.");
    }
  }

  async function handleReconcile(paymentId: string) {
    if (!confirm("Confirm you have verified this bank credit on your official bank statement?")) return;
    try {
      await reconcilePayment(paymentId);
      setFeedback("Bank transfer reconciled! QR tickets have been issued and emailed to the buyer.");
      await loadData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Reconciliation failed.");
    }
  }

  async function handleCalculateSettlement(e: React.FormEvent) {
    e.preventDefault();
    const evt = events.find((x) => x.id === settleEventId);
    if (!evt) return;
    try {
      const org = organizers.find((o) => o.name === evt.organizer.name);
      if (!org) throw new Error("Organizer not found for this event.");
      await calculateSettlement({ eventId: evt.id, organizerId: org.id });
      setShowSettlementModal(false);
      setFeedback("Settlement drafted from immutable ledger entries!");
      await loadData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed to calculate settlement.");
    }
  }

  async function handleApproveSettlement(id: string) {
    if (!confirm("Approve this settlement payout?")) return;
    try {
      await approveSettlement(id);
      setFeedback("Settlement approved for bank payout!");
      await loadData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Approval failed.");
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted">Checking staff session…</div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto border border-line bg-paper p-6 space-y-5">
        <h1 className="font-display text-2xl text-forest">Staff Portal Login</h1>
        <p className="text-sm text-muted">Sign in with your Print X staff account.</p>

        {loginErr && <p className="border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{loginErr}</p>}

        <form onSubmit={handleLogin} className="space-y-4">
          <TextField
            label="Staff Email"
            name="email"
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail((e.target as HTMLInputElement).value)}
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            value={loginPass}
            onChange={(e) => setLoginPass((e.target as HTMLInputElement).value)}
            required
          />
          <Button type="submit" disabled={loggingIn} className="w-full">
            {loggingIn ? "Signing in…" : "Sign In to Admin"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-line pb-4 gap-4">
        <div>
          <h1 className="font-display text-3xl text-forest">Print X Staff Admin</h1>
          <p className="text-xs text-muted mt-1">
            Logged in as <span className="font-medium text-forest">{user.name}</span> ({user.email}) · Role: <span className="font-mono">{user.role}</span>
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs border border-line px-3 py-1.5 text-muted hover:text-danger hover:border-danger rounded"
        >
          Sign Out
        </button>
      </div>

      {feedback && (
        <div className="border border-forest bg-sage-soft p-3 text-sm text-forest flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback("")} className="text-xs font-bold">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-line gap-2 overflow-x-auto text-sm">
        <button
          onClick={() => setTab("events")}
          className={`pb-2 px-3 font-medium transition-colors ${tab === "events" ? "border-b-2 border-forest text-forest" : "text-muted hover:text-forest"}`}
        >
          Events ({events.length})
        </button>
        <button
          onClick={() => setTab("organizers")}
          className={`pb-2 px-3 font-medium transition-colors ${tab === "organizers" ? "border-b-2 border-forest text-forest" : "text-muted hover:text-forest"}`}
        >
          Organizers ({organizers.length})
        </button>
        <button
          onClick={() => setTab("reconciliation")}
          className={`pb-2 px-3 font-medium transition-colors ${tab === "reconciliation" ? "border-b-2 border-forest text-forest" : "text-muted hover:text-forest"}`}
        >
          Bank Reconciliation {reconciliations.length > 0 && <span className="ml-1 bg-gold text-white text-xs px-1.5 py-0.5 rounded-full">{reconciliations.length}</span>}
        </button>
        <button
          onClick={() => setTab("settlements")}
          className={`pb-2 px-3 font-medium transition-colors ${tab === "settlements" ? "border-b-2 border-forest text-forest" : "text-muted hover:text-forest"}`}
        >
          Settlements ({settlements.length})
        </button>
      </div>

      {/* TAB 1: Events */}
      {tab === "events" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-medium text-lg text-forest">Manage Events</h2>
            <Button onClick={() => setShowEventModal(true)}>+ Create Event</Button>
          </div>

          <div className="border border-line bg-paper overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-line/20 text-xs font-medium text-muted uppercase">
                <tr>
                  <th className="p-3">Title / Slug</th>
                  <th className="p-3">Organizer</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Venue</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-line/10">
                    <td className="p-3">
                      <p className="font-medium text-forest">{evt.title}</p>
                      <p className="text-xs font-mono text-muted">{evt.slug}</p>
                    </td>
                    <td className="p-3 text-muted">{evt.organizer?.name}</td>
                    <td className="p-3 text-muted">{formatDate(evt.startsAt)}</td>
                    <td className="p-3 text-muted">{evt.venue}, {evt.city}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-xs rounded ${evt.isPublished ? "bg-sage-soft text-forest" : "bg-line text-muted"}`}>
                        {evt.isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleTogglePublish(evt)}
                        className="text-xs underline hover:text-forest text-muted"
                      >
                        {evt.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <Link href={`/events/${evt.slug}`} target="_blank" className="text-xs text-forest underline">
                        View Page
                      </Link>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted">No events created yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Organizers */}
      {tab === "organizers" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-medium text-lg text-forest">Event Organizers</h2>
            <Button onClick={() => setShowOrgModal(true)}>+ Add Organizer</Button>
          </div>

          <div className="border border-line bg-paper overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-line/20 text-xs font-medium text-muted uppercase">
                <tr>
                  <th className="p-3">Organizer</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Commission</th>
                  <th className="p-3">Bank Details</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {organizers.map((org) => (
                  <tr key={org.id} className="hover:bg-line/10">
                    <td className="p-3 font-medium text-forest">{org.name}</td>
                    <td className="p-3 text-muted">
                      <div>{org.contactEmail}</div>
                      <div className="text-xs">{org.contactPhone}</div>
                    </td>
                    <td className="p-3 font-mono">{org.commissionBps / 100}%</td>
                    <td className="p-3 text-muted text-xs">
                      {org.bankName ? `${org.bankName} - ${org.bankAccount}` : "Not provided"}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-xs rounded ${org.isActive ? "bg-sage-soft text-forest" : "bg-danger/10 text-danger"}`}>
                        {org.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
                {organizers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted">No organizers registered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Bank Reconciliation */}
      {tab === "reconciliation" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-medium text-lg text-forest">Pending Bank Reconciliation</h2>
              <p className="text-xs text-muted">Direct bank transfers awaiting finance confirmation before QR ticket generation.</p>
            </div>
          </div>

          <div className="border border-line bg-paper overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-line/20 text-xs font-medium text-muted uppercase">
                <tr>
                  <th className="p-3">Booking Ref</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Event</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Received Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reconciliations.map((rec) => (
                  <tr key={rec.id} className="hover:bg-line/10">
                    <td className="p-3 font-mono font-medium text-forest">{rec.booking.reference}</td>
                    <td className="p-3 text-muted">
                      <div>{rec.booking.buyerName}</div>
                      <div className="text-xs">{rec.booking.buyerEmail} · {rec.booking.buyerWhatsapp}</div>
                    </td>
                    <td className="p-3 text-muted">{rec.booking.event.title}</td>
                    <td className="p-3 font-medium text-forest">{formatLkr(rec.amountMinor)}</td>
                    <td className="p-3 text-muted text-xs">{formatDate(rec.createdAt)}</td>
                    <td className="p-3 text-right">
                      <Button onClick={() => handleReconcile(rec.id)} className="text-xs py-1 px-3">
                        Reconcile & Issue QR
                      </Button>
                    </td>
                  </tr>
                ))}
                {reconciliations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted">
                      No pending bank transfers awaiting reconciliation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Settlements */}
      {tab === "settlements" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-medium text-lg text-forest">Organizer Payout Settlements</h2>
              <p className="text-xs text-muted">Derived directly from double-entry immutable ledger journals.</p>
            </div>
            <Button onClick={() => setShowSettlementModal(true)}>+ Calculate Settlement</Button>
          </div>

          <div className="border border-line bg-paper overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-line/20 text-xs font-medium text-muted uppercase">
                <tr>
                  <th className="p-3">Event</th>
                  <th className="p-3">Organizer</th>
                  <th className="p-3">Gross Sales</th>
                  <th className="p-3">Print X Fee</th>
                  <th className="p-3">Net Payout</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {settlements.map((set) => (
                  <tr key={set.id} className="hover:bg-line/10">
                    <td className="p-3 font-medium text-forest">{set.event?.title}</td>
                    <td className="p-3 text-muted">{set.organizer?.name}</td>
                    <td className="p-3">{formatLkr(set.grossMinor)}</td>
                    <td className="p-3 text-muted">{formatLkr(set.commissionMinor)}</td>
                    <td className="p-3 font-medium text-forest">{formatLkr(set.netPayableMinor)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-xs rounded ${set.status === "APPROVED" ? "bg-sage-soft text-forest" : "bg-gold/10 text-gold"}`}>
                        {set.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {set.status === "DRAFT" && (
                        <button
                          onClick={() => handleApproveSettlement(set.id)}
                          className="text-xs font-medium text-forest underline hover:no-underline"
                        >
                          Approve Payout
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {settlements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted">
                      No settlements drafted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Event */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleCreateEvent} className="bg-paper border border-line p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-xl text-forest">Create New Event</h2>

            <TextField label="Event Title" name="title" value={newTitle} onChange={(e) => setNewTitle((e.target as HTMLInputElement).value)} required />
            <TextField label="URL Slug" name="slug" value={newSlug} placeholder="e.g. colombo-music-fest-2026" onChange={(e) => setNewSlug((e.target as HTMLInputElement).value)} />

            <div>
              <label className="text-sm font-medium text-forest">Organizer</label>
              <select
                value={newOrgId}
                onChange={(e) => setNewOrgId(e.target.value)}
                className="w-full mt-1 border border-line p-2 text-sm bg-white"
                required
              >
                <option value="">Select an organizer</option>
                {organizers.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <TextField label="Starts At (Date & Time)" name="startsAt" type="datetime-local" value={newStartsAt} onChange={(e) => setNewStartsAt((e.target as HTMLInputElement).value)} required />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Venue" name="venue" value={newVenue} onChange={(e) => setNewVenue((e.target as HTMLInputElement).value)} required />
              <TextField label="City" name="city" value={newCity} onChange={(e) => setNewCity((e.target as HTMLInputElement).value)} required />
            </div>
            <div>
              <label className="text-sm font-medium text-forest">Summary Description</label>
              <textarea
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                className="w-full mt-1 border border-line p-2 text-sm bg-white"
                rows={3}
                required
              />
            </div>

            <div className="border-t border-line pt-3 space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Initial Ticket Tier</h3>
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Tier Name" name="tierName" value={newTierName} onChange={(e) => setNewTierName((e.target as HTMLInputElement).value)} required />
                <TextField label="Code" name="tierCode" value={newTierCode} onChange={(e) => setNewTierCode((e.target as HTMLInputElement).value)} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Price (LKR)" name="tierPrice" type="number" value={newTierPrice} onChange={(e) => setNewTierPrice((e.target as HTMLInputElement).value)} required />
                <TextField label="Capacity" name="tierCapacity" type="number" value={newTierCapacity} onChange={(e) => setNewTierCapacity((e.target as HTMLInputElement).value)} required />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-line">
              <button type="button" onClick={() => setShowEventModal(false)} className="text-sm px-4 py-2 border border-line text-muted">Cancel</button>
              <Button type="submit">Create Event</Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Create Organizer */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleCreateOrganizer} className="bg-paper border border-line p-6 max-w-md w-full space-y-4">
            <h2 className="font-display text-xl text-forest">Add Event Organizer</h2>

            <TextField label="Organizer / Business Name" name="name" value={orgName} onChange={(e) => setOrgName((e.target as HTMLInputElement).value)} required />
            <TextField label="Contact Email" name="email" type="email" value={orgEmail} onChange={(e) => setOrgEmail((e.target as HTMLInputElement).value)} required />
            <TextField label="Contact Phone" name="phone" value={orgPhone} onChange={(e) => setOrgPhone((e.target as HTMLInputElement).value)} required />
            <TextField label="Platform Commission (%)" name="commission" type="number" value={orgCommission} onChange={(e) => setOrgCommission((e.target as HTMLInputElement).value)} required />
            <TextField label="Bank Name" name="bankName" value={orgBankName} onChange={(e) => setOrgBankName((e.target as HTMLInputElement).value)} placeholder="e.g. Commercial Bank" />
            <TextField label="Bank Account Number" name="bankAccount" value={orgBankAccount} onChange={(e) => setOrgBankAccount((e.target as HTMLInputElement).value)} placeholder="e.g. 1000293849" />

            <div className="flex justify-end gap-3 pt-3 border-t border-line">
              <button type="button" onClick={() => setShowOrgModal(false)} className="text-sm px-4 py-2 border border-line text-muted">Cancel</button>
              <Button type="submit">Add Organizer</Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Calculate Settlement */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleCalculateSettlement} className="bg-paper border border-line p-6 max-w-md w-full space-y-4">
            <h2 className="font-display text-xl text-forest">Draft Event Settlement</h2>
            <p className="text-xs text-muted">
              Select an event to reconcile total gross revenues, compute Print X platform commission, and draft net payout.
            </p>

            <div>
              <label className="text-sm font-medium text-forest">Select Event</label>
              <select
                value={settleEventId}
                onChange={(e) => setSettleEventId(e.target.value)}
                className="w-full mt-1 border border-line p-2 text-sm bg-white"
                required
              >
                <option value="">Select an event</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.title} ({e.organizer.name})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-line">
              <button type="button" onClick={() => setShowSettlementModal(false)} className="text-sm px-4 py-2 border border-line text-muted">Cancel</button>
              <Button type="submit">Compute Ledger</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
