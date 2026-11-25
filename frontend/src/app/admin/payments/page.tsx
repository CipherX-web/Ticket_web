"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { type AdminPayment, fetchAllPayments, reconcilePayment } from "@/lib/admin-api";
import { formatDate, formatLkr } from "@/lib/format";
import { Button } from "@/components/Button";
import { useAdminContext } from "../AdminShell";
import { AdminModal, StatusBadge, ToastBanner } from "../AdminUi";

function PaymentsContent() {
  const searchParams = useSearchParams();
  const { refreshBadge } = useAdminContext();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [isSandbox, setIsSandbox] = useState(true);
  const [provider, setProvider] = useState("PAYHERE");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" }>({ msg: "", type: "success" });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("filter") ?? "");
  const [methodFilter, setMethodFilter] = useState("");
  const [selected, setSelected] = useState<AdminPayment | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchAllPayments();
      setPayments(res.items);
      setIsSandbox(res.isSandbox);
      setProvider(res.provider);
      await refreshBadge();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to load payments.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const f = searchParams.get("filter");
    if (f !== null) setStatusFilter(f);
  }, [searchParams]);

  const filtered = payments.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (methodFilter && p.method !== methodFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        p.booking.reference.toLowerCase().includes(q) ||
        p.booking.buyerName.toLowerCase().includes(q) ||
        p.booking.buyerEmail.toLowerCase().includes(q) ||
        (p.providerRef ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleReconcile(p: AdminPayment) {
    if (!confirm(`Confirm bank credit of ${formatLkr(p.amountMinor)} for booking ${p.booking.reference}? This will issue QR tickets immediately.`)) {
      return;
    }
    try {
      await reconcilePayment(p.id);
      setSelected(null);
      setToast({ msg: `Reconciled ${p.booking.reference}. QR tickets issued and queued for email/WhatsApp.`, type: "success" });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Reconciliation failed.", type: "error" });
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <ToastBanner message={toast.msg} type={toast.type} onDismiss={() => setToast({ msg: "", type: "success" })} />

      {isSandbox && (
        <div className="rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <strong>Sandbox Environment ({provider}):</strong> Card gateway transactions shown here are simulated test payments and do not represent live bank settlements.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-line bg-paper p-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ref, customer, provider ref…"
          className="w-64 rounded-sm border border-line bg-ivory px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-sm border border-line bg-ivory px-3 py-2 text-sm">
          <option value="">All Payment Statuses</option>
          <option value="CAPTURED">Captured</option>
          <option value="MANUAL_REVIEW">Manual Review (Bank Transfer)</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="rounded-sm border border-line bg-ivory px-3 py-2 text-sm">
          <option value="">All Methods</option>
          <option value="CARD_GATEWAY">Card Gateway</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
        </select>
      </div>

      <div className="rounded-sm border border-line bg-paper overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-sage-soft/60 text-xs font-medium uppercase text-muted">
            <tr>
              <th className="p-4">Booking Ref</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Event</th>
              <th className="p-4">Method</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Provider Ref</th>
              <th className="p-4">Status</th>
              <th className="p-4">Date</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!loading &&
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-ivory/50">
                  <td className="p-4 font-mono text-xs font-semibold text-forest">{p.booking.reference}</td>
                  <td className="p-4">
                    <div className="font-medium text-forest">{p.booking.buyerName}</div>
                    <div className="text-xs text-muted">{p.booking.buyerEmail}</div>
                  </td>
                  <td className="p-4 text-muted">{p.booking.event.title}</td>
                  <td className="p-4 text-xs">
                    {p.method === "CARD_GATEWAY" ? `${provider}${isSandbox ? " (Sandbox)" : ""}` : "Bank Transfer"}
                  </td>
                  <td className="p-4 font-semibold text-forest">{formatLkr(p.amountMinor)}</td>
                  <td className="p-4 font-mono text-xs text-muted">{p.providerRef ?? "—"}</td>
                  <td className="p-4"><StatusBadge status={p.status} /></td>
                  <td className="p-4 text-xs text-muted">{formatDate(p.createdAt)}</td>
                  <td className="p-4 text-right space-x-3 whitespace-nowrap">
                    <button type="button" onClick={() => setSelected(p)} className="text-xs font-medium text-forest hover:underline">
                      View
                    </button>
                    {p.method === "BANK_TRANSFER" && p.status === "MANUAL_REVIEW" && (
                      <button type="button" onClick={() => handleReconcile(p)} className="text-xs font-medium text-accent hover:underline">
                        Reconcile
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-muted">No payments found.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={9} className="p-8 text-center text-muted">Loading payments…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <AdminModal title={`Payment · ${selected.booking.reference}`} onClose={() => setSelected(null)}>
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-2 text-xs border-b border-line pb-4">
              <dt className="text-muted">Payment ID</dt><dd className="font-mono">{selected.id}</dd>
              <dt className="text-muted">Booking Ref</dt><dd className="font-mono font-semibold">{selected.booking.reference}</dd>
              <dt className="text-muted">Customer</dt><dd>{selected.booking.buyerName} ({selected.booking.buyerEmail})</dd>
              <dt className="text-muted">Event</dt><dd>{selected.booking.event.title}</dd>
              <dt className="text-muted">Amount</dt><dd className="font-semibold text-forest">{formatLkr(selected.amountMinor)}</dd>
              <dt className="text-muted">Method</dt><dd>{selected.method.replace(/_/g, " ")}</dd>
              <dt className="text-muted">Provider Ref</dt><dd className="font-mono">{selected.providerRef ?? "—"}</dd>
              <dt className="text-muted">Status</dt><dd><StatusBadge status={selected.status} /></dd>
              <dt className="text-muted">Verified At</dt><dd>{selected.verifiedAt ? formatDate(selected.verifiedAt) : "Not verified"}</dd>
            </dl>
            <div className="flex justify-between">
              {selected.method === "BANK_TRANSFER" && selected.status === "MANUAL_REVIEW" ? (
                <Button onClick={() => handleReconcile(selected)}>Reconcile & Issue QR</Button>
              ) : <div />}
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted">Loading payments…</div>}>
      <PaymentsContent />
    </Suspense>
  );
}
