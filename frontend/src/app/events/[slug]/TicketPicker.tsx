"use client";
import { useState } from "react";
import Link from "next/link";
import type { EventItem } from "@/data/events";
import { checkoutTickets, createTicketHolds } from "@/lib/api";
import { formatLkr } from "@/lib/format";
import { fieldErrors, guestSchema } from "@/lib/validation";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";

export function TicketPicker({ event }: { event: EventItem & { id?: string } }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<"CARD_GATEWAY" | "BANK_TRANSFER">("CARD_GATEWAY");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    reference: string;
    status: string;
    totalMinor: number;
    buyerEmail: string;
    tickets: Array<{ code: string; qrToken: string; tierName: string }>;
  } | null>(null);

  const lines = event.tiers.map((t) => ({ t, q: qty[t.id] ?? 0 }));
  const count = lines.reduce((n, l) => n + l.q, 0);
  const total = lines.reduce((n, l) => n + l.q * l.t.priceMinor, 0);

  function change(id: string, delta: number, max: number) {
    setConfirmation(null);
    setServerError("");
    setQty((s) => ({ ...s, [id]: Math.min(max, Math.max(0, (s[id] ?? 0) + delta)) }));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError("");
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = guestSchema.safeParse(data);
    const next = parsed.success ? {} : fieldErrors(parsed.error);
    if (count === 0) next.tickets = "Select at least one ticket.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) return;

    if (!event.id) {
      setServerError("Backend API is not connected. Start the backend server to complete checkout.");
      return;
    }

    const items = lines.filter((l) => l.q > 0).map((l) => ({ tierId: l.t.id, quantity: l.q }));
    setSubmitting(true);
    try {
      const held = await createTicketHolds(items);
      const res = await checkoutTickets(
        {
          eventId: event.id,
          items,
          holdIds: held.holds.map((h) => h.id),
          buyerName: parsed.data.name,
          buyerEmail: parsed.data.email,
          buyerWhatsapp: parsed.data.whatsapp,
          paymentMethod: method,
        },
        crypto.randomUUID(),
      );
      setConfirmation({ ...res, buyerEmail: parsed.data.email });
      setQty({});
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6 border border-line bg-paper p-6" aria-label="Ticket selection">
      <fieldset>
        <legend className="text-sm font-medium uppercase tracking-[0.18em] text-forest/70">Tickets</legend>
        <ul className="mt-3 divide-y divide-line">
          {lines.map(({ t, q }) => {
            const max = Math.min(t.perOrderMax, t.available);
            return (
              <li key={t.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium text-forest">{t.name}</p>
                  <p className="text-sm text-muted">
                    {formatLkr(t.priceMinor)} · {t.available === 0 ? "Sold out" : t.available <= 20 ? `Only ${t.available} left` : `${t.available} available`}
                  </p>
                </div>
                <div className="flex items-center gap-3" role="group" aria-label={`${t.name} quantity`}>
                  <button type="button" disabled={q === 0} onClick={() => change(t.id, -1, max)} aria-label={`Remove one ${t.name}`} className="h-9 w-9 border border-line disabled:opacity-40">−</button>
                  <output className="w-6 text-center" aria-live="polite">{q}</output>
                  <button type="button" disabled={max === 0 || q >= max} onClick={() => change(t.id, 1, max)} aria-label={`Add one ${t.name}`} className="h-9 w-9 border border-line disabled:opacity-40">+</button>
                </div>
              </li>
            );
          })}
        </ul>
        <p role="alert" className="min-h-5 text-sm text-danger">{errors.tickets}</p>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium uppercase tracking-[0.18em] text-forest/70">Your details</legend>
        <TextField label="Full name" name="name" autoComplete="name" error={errors.name} />
        <TextField label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
        <TextField label="WhatsApp number" name="whatsapp" type="tel" autoComplete="tel" placeholder="+94 77 123 4567" error={errors.whatsapp} />
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium uppercase tracking-[0.18em] text-forest/70">Payment method</legend>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <button type="button" onClick={() => setMethod("CARD_GATEWAY")} className={`border px-3 py-2.5 ${method === "CARD_GATEWAY" ? "border-accent bg-sage-soft font-medium text-forest" : "border-line text-muted"}`}>
            Card (Instant QR)
          </button>
          <button type="button" onClick={() => setMethod("BANK_TRANSFER")} className={`border px-3 py-2.5 ${method === "BANK_TRANSFER" ? "border-accent bg-sage-soft font-medium text-forest" : "border-line text-muted"}`}>
            Bank Transfer
          </button>
        </div>
      </fieldset>

      <div className="flex items-center justify-between border-t border-line pt-4">
        <p className="text-sm text-muted">{count} ticket{count === 1 ? "" : "s"}</p>
        <p className="text-xl font-medium text-forest">{formatLkr(total)}</p>
      </div>

      {serverError && <p role="alert" className="border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{serverError}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Reserving & Issuing…" : "Continue to payment"}
      </Button>

      {confirmation && (
        <div role="status" className="space-y-3 border border-forest bg-sage-soft p-4 text-sm text-forest">
          <p className="font-medium">Booking {confirmation.reference} · {confirmation.status.replace(/_/g, " ")}</p>
          <p>Total: {formatLkr(confirmation.totalMinor)}</p>

          {confirmation.tickets.length > 0 ? (
            <>
              <ul className="space-y-1 border-t border-line pt-2 text-xs">
                {confirmation.tickets.map((tk) => (
                  <li key={tk.code} className="flex justify-between font-mono">
                    <span>{tk.tierName}</span>
                    <span>{tk.code}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/tickets/${confirmation.reference}?email=${encodeURIComponent(confirmation.buyerEmail)}`}
                className="mt-2 block text-center text-sm font-medium underline hover:no-underline"
              >
                View & download your QR tickets →
              </Link>
            </>
          ) : (
            <p className="text-xs text-muted">
              Bank transfer is awaiting finance reconciliation before QR issuance. You will receive an email when your tickets are ready.
            </p>
          )}
        </div>
      )}

      <p className="text-center text-xs text-muted">
        Lost your tickets?{" "}
        <Link href="/tickets/recover" className="underline hover:text-forest">
          Recover by email
        </Link>
      </p>
    </form>
  );
}

