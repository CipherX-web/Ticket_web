/**
 * /tickets/[reference] – Buyer ticket viewer
 *
 * Shows all tickets for a booking. The buyer provides their email to authenticate.
 * Each QR code is rendered as an inline SVG-based QR (using URL-encoded data URI)
 * that can be screenshotted or printed for event entry.
 *
 * URL: /tickets/ABC123?email=buyer@example.com (pre-fills from email link)
 */
import type { Metadata } from "next";
import { TicketViewer } from "./TicketViewer";

type Props = { params: Promise<{ reference: string }>; searchParams: Promise<{ email?: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Tickets · ${reference.toUpperCase()}` };
}

export default async function TicketPage({ params, searchParams }: Props) {
  const { reference } = await params;
  const { email } = await searchParams;
  return <TicketViewer reference={reference.toUpperCase()} prefillEmail={email ?? ""} />;
}
