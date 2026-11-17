"use client";
import { useState } from "react";
import type { EventItem } from "@/data/events";
import { formatLkr } from "@/lib/format";
import { fieldErrors, guestSchema } from "@/lib/validation";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";

export function TicketPicker({ event }: { event: EventItem }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const lines = event.tiers.map((t) => ({ t, q: qty[t.id] ?? 0 }));
  const count = lines.reduce((n, l) => n + l.q, 0);
  const total = lines.reduce((n, l) => n + l.q * l.t.priceMinor, 0);

  function change(id: string, delta: number, max: number) {
    setDone(false);
    setQty((s) => ({ ...s, [id]: Math.min(max, Math.max(0, (s[id] ?? 0) + delta)) }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = guestSchema.safeParse(data);
    const next = parsed.success ? {} : fieldErrors(parsed.error);
    if (count === 0) next.tickets = "Select at least one ticket.";
    setErrors(next);
    setDone(Object.keys(next).length === 0);
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
                  <p className="text-sm text-muted">{formatLkr(t.priceMinor)} · {t.available === 0 ? "Sold out" : t.available <= 20 ? `Only ${t.available} left` : "Available"}</p>
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

      <div className="flex items-center justify-between border-t border-line pt-4">
        <p className="text-sm text-muted">{count} ticket{count === 1 ? "" : "s"}</p>
        <p className="text-xl font-medium text-forest">{formatLkr(total)}</p>
      </div>
      <p className="text-xs text-muted">Tickets are held briefly while you pay. Seats are never guaranteed until payment is verified.</p>
      <Button type="submit" className="w-full">Continue to payment</Button>
      {done && (
        <p role="status" className="border border-sage bg-sage-soft p-3 text-sm text-forest">
          Details look valid. Inventory hold and secure payment connect in the ticketing phase. Nothing was sent or reserved.
        </p>
      )}
    </form>
  );
}
