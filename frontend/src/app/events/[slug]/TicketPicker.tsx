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
              {typeof window !== "undefined" && (
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `🎟️ Print X Tickets - ${event.title}\nRef: ${confirmation.reference}\nTickets: ${confirmation.tickets.length}\nView/Download QR Pass: ${window.location.origin}/tickets/${confirmation.reference}?email=${encodeURIComponent(confirmation.buyerEmail)}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center justify-center gap-2 rounded bg-[#25D366] px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm hover:opacity-95 transition-opacity"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.99.54 1.785.836 2.796.837 3.18 0 5.767-2.587 5.768-5.766.001-3.182-2.585-5.77-5.768-5.772zm3.393 8.245c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.087-.179.182-.077.357.101.174.45 1.054 1.157 1.683.707.629 1.303.824 1.488.916.185.092.293.078.402-.047.11-.125.462-.538.584-.723.123-.185.246-.154.412-.092.166.062 1.055.498 1.236.588.181.09.303.135.347.211.044.076.044.441-.1.846z" />
                  </svg>
                  <span>Share / Open in WhatsApp</span>
                </a>
              )}
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

