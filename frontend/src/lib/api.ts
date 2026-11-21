import type { Product } from "@/data/products";
import type { EventItem } from "@/data/events";

function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") return "/v1";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/v1`;
  return "http://localhost:4000/v1";
}

export const API_BASE = getApiBase();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new Error(msg ?? "Request failed. Please try again.");
  }
  return data as T;
}

export interface ApiEvent {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  venue: string;
  city: string;
  summary: string;
  organizer: { name: string };
  tiers: Array<{
    id: string;
    code: string;
    name: string;
    priceMinor: number;
    available: number;
    perOrderMax: number;
  }>;
}

export function mapApiEvent(e: ApiEvent): EventItem & { id: string } {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    organizer: e.organizer.name,
    date: e.startsAt,
    venue: e.venue,
    city: e.city,
    summary: e.summary,
    tiers: e.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      priceMinor: t.priceMinor,
      available: t.available,
      perOrderMax: t.perOrderMax,
    })),
  };
}

export async function fetchProducts(): Promise<Product[] | null> {
  try {
    return await request<Product[]>("/commerce/products", { cache: "no-store" });
  } catch {
    return null;
  }
}

export async function fetchProduct(slug: string): Promise<Product | null> {
  try {
    return await request<Product>(`/commerce/products/${encodeURIComponent(slug)}`, { cache: "no-store" });
  } catch {
    return null;
  }
}

export function createPrintOrder(payload: {
  productSlug: string;
  sizeId: string;
  materialId: string;
  finishId: string;
  quantity: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  artworkName?: string;
}) {
  return request<{ reference: string; status: string; totalMinor: number }>("/commerce/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function trackPrintOrder(reference: string, email: string) {
  return request<{
    found: boolean;
    message?: string;
    reference?: string;
    productName?: string;
    quantity?: number;
    totalMinor?: number;
    status?: string;
    proofRequired?: boolean;
    approvedAt?: string | null;
  }>("/commerce/track", {
    method: "POST",
    body: JSON.stringify({ reference, email }),
  });
}

export function approvePrintProof(reference: string, email: string) {
  return request<{ reference: string; status: string; approvedAt: string }>("/commerce/orders/approve-proof", {
    method: "POST",
    body: JSON.stringify({ reference, email }),
  });
}

export function submitContact(payload: { name: string; email: string; message: string }) {
  return request<{ id: string; received: boolean }>("/commerce/contact", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchEvents(): Promise<(EventItem & { id?: string })[] | null> {
  try {
    const list = await request<ApiEvent[]>("/events", { cache: "no-store" });
    return list.map(mapApiEvent);
  } catch {
    return null;
  }
}

export async function fetchEvent(slug: string): Promise<(EventItem & { id?: string }) | null> {
  try {
    const item = await request<ApiEvent>(`/events/${encodeURIComponent(slug)}`, { cache: "no-store" });
    return mapApiEvent(item);
  } catch {
    return null;
  }
}

export function createTicketHolds(items: Array<{ tierId: string; quantity: number }>) {
  return request<{ expiresAt: string; holds: Array<{ id: string }> }>("/ticketing/holds", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export function checkoutTickets(
  payload: {
    eventId: string;
    items: Array<{ tierId: string; quantity: number }>;
    holdIds?: string[];
    buyerName: string;
    buyerEmail: string;
    buyerWhatsapp: string;
    paymentMethod: "CARD_GATEWAY" | "BANK_TRANSFER";
  },
  idempotencyKey: string,
) {
  return request<{
    bookingId: string;
    reference: string;
    status: string;
    totalMinor: number;
    tickets: Array<{ code: string; qrToken: string; tierName: string }>;
  }>("/ticketing/checkout", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
}

export interface PublicInvitation {
  guestName: string;
  maxPartySize: number;
  rsvpStatus: "PENDING" | "ACCEPTED" | "DECLINED";
  rsvpCount: number;
  campaign: {
    coupleTitle: string;
    eventDate: string;
    venueName: string;
    venueAddress: string;
    storyText: string;
  };
}

export async function fetchPublicInvitation(token: string): Promise<PublicInvitation | null> {
  try {
    return await request<PublicInvitation>(`/invitations/public/${encodeURIComponent(token)}`, { cache: "no-store" });
  } catch {
    return null;
  }
}

export function submitInvitationRsvp(token: string, payload: { status: "ACCEPTED" | "DECLINED"; count: number }) {
  return request<{ rsvpStatus: string; rsvpCount: number }>(`/invitations/public/${encodeURIComponent(token)}/rsvp`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
