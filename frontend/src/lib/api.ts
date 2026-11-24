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

export function createPaymentSession(payload: {
  bookingId: string;
  returnUrl?: string;
  cancelUrl?: string;
}) {
  return request<{
    bookingReference: string;
    amountFormatted: string;
    currency: string;
    gateway: {
      provider: "PAYHERE" | "WEBXPAY" | "GENERIC";
      actionUrl: string;
      method: "POST" | "GET";
      fields: Record<string, string>;
    };
  }>("/payments/session", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── Staff Admin APIs ─────────────────────────────────────────────────────────

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function staffLogin(payload: { email: string; password: string }) {
  return request<{ user: StaffUser }>("/auth/login", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export function staffLogout() {
  return request<{ ok: boolean }>("/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

export function fetchStaffMe() {
  return request<{ user: StaffUser }>("/auth/me", {
    credentials: "include",
  });
}

export interface AdminEvent {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  venue: string;
  city: string;
  summary: string;
  approvalMode: string;
  isPublished: boolean;
  organizer: { name: string };
  tiers: Array<{
    id: string;
    code: string;
    name: string;
    priceMinor: number;
    capacity: number;
    available: number;
    perOrderMax: number;
  }>;
}

export function fetchAdminEvents() {
  return request<AdminEvent[]>("/admin/events", { credentials: "include" });
}

export function createAdminEvent(payload: {
  title: string;
  slug: string;
  organizerId: string;
  startsAt: string;
  venue: string;
  city: string;
  summary: string;
  approvalMode?: "AUTOMATIC" | "MANUAL" | "HYBRID";
  isPublished?: boolean;
  tiers: Array<{
    code: string;
    name: string;
    priceMinor: number;
    capacity: number;
    perOrderMax: number;
  }>;
}) {
  return request<AdminEvent>("/admin/events", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export function togglePublishEvent(id: string, publish: boolean) {
  return request<AdminEvent>(`/admin/events/${id}/${publish ? "publish" : "unpublish"}`, {
    method: "POST",
    credentials: "include",
  });
}

export function fetchEventStats(id: string) {
  return request<{
    eventId: string;
    title: string;
    tiers: Array<{ name: string; capacity: number; available: number; sold: number }>;
    totalBookings: number;
    confirmedBookings: number;
    confirmedRevenueMinor: number;
  }>(`/admin/events/${id}/stats`, { credentials: "include" });
}

export interface Organizer {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  commissionBps: number;
  bankName: string | null;
  bankAccount: string | null;
  isActive: boolean;
  createdAt: string;
}

export function fetchOrganizers() {
  return request<Organizer[]>("/organizers", { credentials: "include" });
}

export function createOrganizer(payload: {
  name: string;
  contactEmail: string;
  contactPhone: string;
  commissionBps?: number;
  bankName?: string;
  bankAccount?: string;
}) {
  return request<Organizer>("/organizers", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export interface PendingReconciliation {
  id: string;
  bookingId: string;
  method: string;
  status: string;
  amountMinor: number;
  createdAt: string;
  booking: {
    reference: string;
    buyerName: string;
    buyerEmail: string;
    buyerWhatsapp: string;
    event: { title: string; startsAt: string };
    tickets: Array<{ code: string }>;
  };
}

export function fetchPendingReconciliations() {
  return request<PendingReconciliation[]>("/payments/pending-reconciliations", { credentials: "include" });
}

export function reconcilePayment(id: string) {
  return request<{ id: string; status: string }>(`/payments/${id}/reconcile`, {
    method: "POST",
    credentials: "include",
  });
}

export interface Settlement {
  id: string;
  organizerId: string;
  eventId: string;
  grossMinor: number;
  commissionMinor: number;
  feesMinor: number;
  netPayableMinor: number;
  status: string;
  createdAt: string;
  organizer: { name: string };
  event: { title: string };
}

export function fetchSettlements() {
  return request<Settlement[]>("/settlements", { credentials: "include" });
}

export function calculateSettlement(payload: { eventId: string; organizerId: string }) {
  return request<Settlement>("/settlements/calculate", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export function approveSettlement(id: string) {
  return request<Settlement>(`/settlements/${id}/approve`, {
    method: "POST",
    credentials: "include",
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

export function lookupBooking(reference: string, email: string) {
  return request<{
    reference: string;
    status: string;
    totalMinor: number;
    currency: string;
    buyerName: string;
    event: { title: string; startsAt: string; venue: string; city: string };
    tickets: Array<{ code: string; qrToken: string; tierName: string; status: string; checkedInAt: string | null }>;
  }>("/ticketing/booking/lookup", {
    method: "POST",
    body: JSON.stringify({ reference, email }),
  });
}

export function requestRecoveryOtp(email: string) {
  return request<{ sent: boolean; message: string }>("/ticketing/recovery/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verifyRecoveryOtp(
  email: string,
  otp: string,
) {
  return request<{
    bookings: Array<{
      reference: string;
      status: string;
      totalMinor: number;
      createdAt: string;
      event: { title: string; startsAt: string; venue: string };
      tickets: Array<{ code: string; status: string }>;
    }>;
  }>("/ticketing/recovery/verify", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
}

export function submitInvitationRsvp(token: string, payload: { status: "ACCEPTED" | "DECLINED"; count: number }) {
  return request<{ rsvpStatus: string; rsvpCount: number }>(`/invitations/public/${encodeURIComponent(token)}/rsvp`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
