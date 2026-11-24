"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { lookupBooking } from "@/lib/api";
import { formatDate, formatLkr } from "@/lib/format";
import { Button } from "@/components/Button";

type Booking = Awaited<ReturnType<typeof lookupBooking>>;

export function CheckoutReturnContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("order_id") || "";
  const emailParam = searchParams.get("email") || "";
  const statusParam = searchParams.get("status") || "";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isCancelled = statusParam === "cancelled" || statusParam === "-1";

  useEffect(() => {
    if (!reference || isCancelled) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let pollCount = 0;

    async function checkStatus() {
      try {
        if (!emailParam) {
          if (isMounted) setLoading(false);
          return;
        }
        const data = await lookupBooking(reference, emailParam);
        if (isMounted) {
          setBooking(data);
          // If status is still pending payment/review, poll a couple of times for webhook arrival
          if (data.status === "PENDING_PAYMENT" && pollCount < 5) {
            pollCount++;
            setTimeout(checkStatus, 2500);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to retrieve order details.");
          setLoading(false);
        }
      }
    }

    void checkStatus();

    return () => {
      isMounted = false;
    };
  }, [reference, emailParam, isCancelled]);

  if (isCancelled) {
    return (
      <div className="border border-line bg-paper p-6 text-center space-y-4">
        <h1 className="font-display text-2xl text-danger">Payment Cancelled</h1>
        <p className="text-sm text-muted">
          Your payment transaction was cancelled. No charges were made to your account.
        </p>
        {reference && (
          <p className="text-xs font-mono text-muted">Order Reference: {reference}</p>
        )}
        <div className="pt-4">
          <Link href="/events" className="inline-block border border-line px-5 py-2 text-sm text-forest hover:bg-line">
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border border-line bg-paper p-8 text-center space-y-4">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
        <h1 className="font-display text-xl text-forest">Verifying payment with bank…</h1>
        <p className="text-sm text-muted">
          Please wait while we receive the secure confirmation from your payment gateway.
        </p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="border border-line bg-paper p-6 space-y-4">
        <h1 className="font-display text-2xl text-forest">Payment Received</h1>
        <p className="text-sm text-muted">
          Thank you! If you completed payment, your tickets are being confirmed by our payment gateway.
        </p>
        {reference && (
          <div className="p-3 bg-line/20 font-mono text-sm">
            <span className="text-muted">Booking Reference: </span>
            <span className="font-medium text-forest">{reference}</span>
          </div>
        )}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          {reference && (
            <Link
              href={`/tickets/${reference}${emailParam ? `?email=${encodeURIComponent(emailParam)}` : ""}`}
              className="inline-block bg-forest text-paper px-4 py-2 text-center text-sm font-medium hover:opacity-90"
            >
              Check Ticket Status →
            </Link>
          )}
          <Link
            href="/events"
            className="inline-block border border-line px-4 py-2 text-center text-sm text-forest hover:bg-line"
          >
            Return to Events
          </Link>
        </div>
      </div>
    );
  }

  const isConfirmed = booking.status === "CONFIRMED";

  return (
    <div className="border border-line bg-paper p-6 space-y-6">
      <div className="text-center space-y-2">
        <span className="inline-block text-3xl">🎉</span>
        <h1 className="font-display text-2xl text-forest">
          {isConfirmed ? "Payment Successful & Tickets Issued!" : "Payment Processing"}
        </h1>
        <p className="text-sm text-muted">
          Booking Reference: <span className="font-mono font-medium text-forest">{booking.reference}</span>
        </p>
      </div>

      <div className="border-t border-b border-line py-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Event:</span>
          <span className="font-medium text-forest">{booking.event.title}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Amount:</span>
          <span className="font-medium text-forest">{formatLkr(booking.totalMinor)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Status:</span>
          <span className="font-medium capitalize text-forest">{booking.status.toLowerCase().replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <Link
          href={`/tickets/${booking.reference}?email=${encodeURIComponent(emailParam)}`}
          className="block w-full bg-forest text-paper py-2.5 text-center text-sm font-medium hover:opacity-90 rounded"
        >
          View QR Pass Tickets →
        </Link>
        <Link
          href="/events"
          className="block w-full border border-line py-2 text-center text-sm text-muted hover:text-forest"
        >
          Browse more events
        </Link>
      </div>
    </div>
  );
}
