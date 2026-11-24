"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { lookupBooking } from "@/lib/api";
import { formatDate, formatLkr } from "@/lib/format";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { QrCode } from "./QrCode";

type Booking = Awaited<ReturnType<typeof lookupBooking>>;

interface Props {
  reference: string;
  prefillEmail: string;
}

export function TicketViewer({ reference, prefillEmail }: Props) {
  const [email, setEmail] = useState(prefillEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);

  async function fetchBooking(cleanEmail: string) {
    if (!cleanEmail) return;
    setError("");
    setLoading(true);
    try {
      const data = await lookupBooking(reference, cleanEmail);
      setBooking(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find booking. Check the email address.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (prefillEmail) {
      void fetchBooking(prefillEmail.toLowerCase().trim());
    }
  }, [reference, prefillEmail]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    await fetchBooking(email.toLowerCase().trim());
  }

  const statusColor: Record<string, string> = {
    CONFIRMED: "text-forest bg-sage-soft",
    PENDING_MANUAL_REVIEW: "text-gold bg-gold/10",
    PENDING_PAYMENT: "text-muted bg-line",
    CANCELLED: "text-danger bg-danger/10",
    REFUNDED: "text-muted bg-line",
  };

  return (
    <div className="container-x py-10 max-w-2xl">
      <nav aria-label="Breadcrumb" className="text-sm text-muted mb-6">
        <Link className="hover:text-forest" href="/events">Events</Link>
        {" / "}
        <span className="text-forest">Your tickets · {reference}</span>
      </nav>

      {!booking && (
        <form onSubmit={handleLookup} className="space-y-5 border border-line bg-paper p-6">
          <h1 className="font-display text-2xl text-forest">View your tickets</h1>
          <p className="text-sm text-muted">Enter the email address you used when booking.</p>

          <TextField
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
          />

          {error && (
            <p role="alert" className="border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Checking…" : "Show my tickets"}
          </Button>
        </form>
      )}

      {booking && (
        <div className="space-y-6">
          {/* Booking summary */}
          <div className="border border-line bg-paper p-6 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl text-forest">{booking.event.title}</h1>
                <p className="text-sm text-muted mt-1">
                  {formatDate(booking.event.startsAt)} · {booking.event.venue}, {booking.event.city}
                </p>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-sm whitespace-nowrap ${statusColor[booking.status] ?? "text-muted bg-line"}`}>
                {booking.status.replace(/_/g, " ")}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Reference</dt>
              <dd className="font-mono">{booking.reference}</dd>
              <dt className="text-muted">Name</dt>
              <dd>{booking.buyerName}</dd>
              <dt className="text-muted">Total paid</dt>
              <dd>{formatLkr(booking.totalMinor)}</dd>
            </dl>

            {booking.status === "PENDING_MANUAL_REVIEW" && (
              <p className="text-sm border border-gold/40 bg-gold/5 p-3 text-forest/80">
                Your bank transfer is awaiting reconciliation by our finance team. QR tickets will be issued once confirmed. We will email you when ready.
              </p>
            )}

            {booking.tickets.length > 0 && typeof window !== "undefined" && (
              <div className="pt-2 border-t border-line">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `🎟️ Print X Tickets - ${booking.event.title}\nRef: ${booking.reference}\nTickets: ${booking.tickets.length}\nView/Download QR Pass: ${window.location.origin}/tickets/${booking.reference}?email=${encodeURIComponent(email)}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded bg-[#25D366] px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm hover:opacity-95 transition-opacity"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.99.54 1.785.836 2.796.837 3.18 0 5.767-2.587 5.768-5.766.001-3.182-2.585-5.77-5.768-5.772zm3.393 8.245c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.087-.179.182-.077.357.101.174.45 1.054 1.157 1.683.707.629 1.303.824 1.488.916.185.092.293.078.402-.047.11-.125.462-.538.584-.723.123-.185.246-.154.412-.092.166.062 1.055.498 1.236.588.181.09.303.135.347.211.044.076.044.441-.1.846z" />
                  </svg>
                  <span>Share / Open in WhatsApp</span>
                </a>
              </div>
            )}
          </div>

          {/* Individual QR tickets */}
          {booking.tickets.length > 0 ? (
            <ul className="space-y-4" aria-label="Tickets">
              {booking.tickets.map((ticket) => (
                <li key={ticket.code} className="border border-line bg-paper p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-forest">{ticket.tierName}</p>
                      <p className="text-xs font-mono text-muted mt-0.5">{ticket.code}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-sm ${
                      ticket.status === "VALID"
                        ? "bg-sage-soft text-forest"
                        : ticket.status === "CHECKED_IN"
                        ? "bg-line text-muted"
                        : "bg-danger/10 text-danger"
                    }`}>
                      {ticket.status === "VALID" ? "Valid" : ticket.status === "CHECKED_IN" ? "Used" : ticket.status}
                    </span>
                  </div>

                  {ticket.status === "VALID" && (
                    <div className="flex flex-col items-center gap-3 py-2">
                      <QrCode value={ticket.qrToken || ticket.code} size={200} />
                      <p className="text-xs text-muted text-center">
                        Screenshot or show this QR at the venue gate
                      </p>
                    </div>
                  )}

                  {ticket.status === "CHECKED_IN" && ticket.checkedInAt && (
                    <p className="text-xs text-muted">
                      Checked in at {formatDate(ticket.checkedInAt)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted text-center py-6">No tickets issued yet for this booking.</p>
          )}

          <button
            onClick={() => setBooking(null)}
            className="text-sm text-muted hover:text-forest underline"
          >
            Look up a different booking
          </button>
        </div>
      )}
    </div>
  );
}
