"use client";
import { useState } from "react";
import Link from "next/link";
import { requestRecoveryOtp, verifyRecoveryOtp } from "@/lib/api";
import { formatDate, formatLkr } from "@/lib/format";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";

type Step = "email" | "otp" | "results";

type Bookings = Awaited<ReturnType<typeof verifyRecoveryOtp>>["bookings"];

export function RecoveryFlow() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bookings, setBookings] = useState<Bookings>([]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await requestRecoveryOtp(cleanEmail);
      setNotice(res.message);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await verifyRecoveryOtp(cleanEmail, cleanOtp);
      setBookings(res.bookings);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  }

  const statusLabel: Record<string, string> = {
    CONFIRMED: "Confirmed",
    PENDING_MANUAL_REVIEW: "Awaiting reconciliation",
    PENDING_PAYMENT: "Pending payment",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
  };

  const statusColor: Record<string, string> = {
    CONFIRMED: "text-forest bg-sage-soft",
    PENDING_MANUAL_REVIEW: "text-gold bg-gold/10",
    PENDING_PAYMENT: "text-muted bg-line",
    CANCELLED: "text-danger bg-danger/10",
    REFUNDED: "text-muted bg-line",
  };

  return (
    <div className="space-y-6">
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-muted mb-4">
          <Link className="hover:text-forest" href="/events">Events</Link>
          {" / "}
          <span className="text-forest">Recover tickets</span>
        </nav>
        <h1 className="font-display text-3xl text-forest">Recover your tickets</h1>
        <p className="mt-2 text-sm text-muted">
          Lost your confirmation email? Enter the email address you used when booking and we will send you a 6-digit code.
        </p>
      </div>

      {/* Step 1: Email */}
      {step === "email" && (
        <form onSubmit={handleEmailSubmit} className="space-y-5 border border-line bg-paper p-6">
          <TextField
            label="Your email address"
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
            {loading ? "Sending code…" : "Send verification code"}
          </Button>
        </form>
      )}

      {/* Step 2: OTP */}
      {step === "otp" && (
        <form onSubmit={handleOtpSubmit} className="space-y-5 border border-line bg-paper p-6">
          {notice && (
            <p className="border border-forest/30 bg-sage-soft p-3 text-sm text-forest">
              {notice}
            </p>
          )}
          <TextField
            label="6-digit code"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp((e.target as HTMLInputElement).value.replace(/\D/g, "").slice(0, 6))}
          />
          {error && (
            <p role="alert" className="border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading || otp.length !== 6} className="w-full">
            {loading ? "Verifying…" : "Verify code"}
          </Button>
          <button
            type="button"
            onClick={() => { setStep("email"); setError(""); setOtp(""); }}
            className="w-full text-sm text-muted hover:text-forest underline"
          >
            Use a different email
          </button>
        </form>
      )}

      {/* Step 3: Results */}
      {step === "results" && (
        <div className="space-y-4">
          {bookings.length === 0 ? (
            <div className="border border-line bg-paper p-6 text-center space-y-3">
              <p className="text-muted">No bookings found for <strong>{email}</strong>.</p>
              <button
                onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                className="text-sm underline text-muted hover:text-forest"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                Found <strong>{bookings.length}</strong> booking{bookings.length !== 1 ? "s" : ""} for <strong>{email}</strong>.
              </p>
              <ul className="space-y-3">
                {bookings.map((b) => (
                  <li key={b.reference} className="border border-line bg-paper p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-forest">{b.event.title}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {formatDate(b.event.startsAt)} · {b.event.venue}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-sm whitespace-nowrap ${statusColor[b.status] ?? "text-muted bg-line"}`}>
                        {statusLabel[b.status] ?? b.status}
                      </span>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <dt className="text-muted">Reference</dt>
                      <dd className="font-mono">{b.reference}</dd>
                      <dt className="text-muted">Total</dt>
                      <dd>{formatLkr(b.totalMinor)}</dd>
                      <dt className="text-muted">Tickets</dt>
                      <dd>{b.tickets.length}</dd>
                    </dl>

                    {b.status === "CONFIRMED" && b.tickets.length > 0 && (
                      <Link
                        href={`/tickets/${b.reference}?email=${encodeURIComponent(email)}`}
                        className="inline-block text-sm font-medium text-forest underline hover:no-underline"
                      >
                        View QR tickets →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
