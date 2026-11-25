function getAdminApiBase(): string {
  if (typeof window !== "undefined") return "/v1";
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  return "http://localhost:4000/v1";
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getAdminApiBase()}${path}`, {
    ...init,
    credentials: "include",
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

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function staffLogin(payload: { email: string; password: string }) {
  return adminRequest<{ user: StaffUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function staffLogout() {
  return adminRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export function fetchStaffMe() {
  return adminRequest<{ user: StaffUser }>("/auth/me");
}

// ─── Events & Ticket Categories (Tiers) ───────────────────────────────────────

export interface AdminTier {
  id: string;
  eventId: string;
  code: string;
  name: string;
  priceMinor: number;
  capacity: number;
  available: number;
  perOrderMax: number;
}

export interface AdminEvent {
  id: string;
  slug: string;
  title: string;
  organizerId: string;
  startsAt: string;
  venue: string;
  city: string;
  summary: string;
  approvalMode: "AUTOMATIC" | "MANUAL" | "HYBRID";
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  organizer: { name: string };
  tiers: AdminTier[];
}

export function fetchAdminEvents() {
  return adminRequest<AdminEvent[]>("/admin/events");
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
  return adminRequest<AdminEvent>("/admin/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminEvent(
  id: string,
  payload: Partial<{
    title: string;
    startsAt: string;
    venue: string;
    city: string;
    summary: string;
    approvalMode: "AUTOMATIC" | "MANUAL" | "HYBRID";
    isPublished: boolean;
  }>,
) {
  return adminRequest<AdminEvent>(`/admin/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function togglePublishEvent(id: string, publish: boolean) {
  return adminRequest<AdminEvent>(`/admin/events/${id}/${publish ? "publish" : "unpublish"}`, {
    method: "POST",
  });
}

export function addEventTier(
  eventId: string,
  payload: { code: string; name: string; priceMinor: number; capacity: number; perOrderMax: number },
) {
  return adminRequest<AdminTier>(`/admin/events/${eventId}/tiers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEventTier(
  tierId: string,
  payload: Partial<{ name: string; priceMinor: number; capacity: number; perOrderMax: number }>,
) {
  return adminRequest<AdminTier>(`/admin/events/tiers/${tierId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteEventTier(tierId: string) {
  return adminRequest<{ deleted: boolean; id: string }>(`/admin/events/tiers/${tierId}`, {
    method: "DELETE",
  });
}

// ─── Bookings & Attendees ─────────────────────────────────────────────────────

export interface AdminBooking {
  id: string;
  reference: string;
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  buyerWhatsapp: string;
  totalMinor: number;
  currency: string;
  status: "PENDING_PAYMENT" | "CONFIRMED" | "PENDING_MANUAL_REVIEW" | "CANCELLED" | "REFUNDED";
  createdAt: string;
  event: { id: string; title: string; slug: string; startsAt: string; venue: string };
  tickets: Array<{
    id: string;
    code: string;
    status: "VALID" | "CHECKED_IN" | "CANCELLED";
    checkedInAt: string | null;
    tier: { id: string; name: string; code: string; priceMinor: number };
  }>;
  payments: Array<{
    id: string;
    method: "CARD_GATEWAY" | "BANK_TRANSFER";
    status: "PENDING" | "CAPTURED" | "FAILED" | "MANUAL_REVIEW" | "REFUNDED";
    amountMinor: number;
    providerRef: string | null;
    verifiedAt: string | null;
    createdAt: string;
  }>;
}

export function fetchAdminBookings(params?: { eventId?: string; status?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params?.eventId) sp.set("eventId", params.eventId);
  if (params?.status) sp.set("status", params.status);
  if (params?.q) sp.set("q", params.q);
  const qs = sp.toString();
  return adminRequest<AdminBooking[]>(`/ticketing/admin/bookings${qs ? `?${qs}` : ""}`);
}

export function cancelAdminBooking(bookingId: string) {
  return adminRequest<{ cancelled: boolean; id: string; reference: string }>(
    `/ticketing/admin/bookings/${bookingId}/cancel`,
    { method: "POST" },
  );
}

export interface AdminAttendee {
  id: string;
  code: string;
  status: "VALID" | "CHECKED_IN" | "CANCELLED";
  checkedInAt: string | null;
  checkedInBy: string | null;
  createdAt: string;
  tier: { id: string; name: string; code: string; priceMinor: number };
  booking: {
    id: string;
    reference: string;
    buyerName: string;
    buyerEmail: string;
    buyerWhatsapp: string;
    status: string;
    createdAt: string;
    event: { id: string; title: string; startsAt: string };
  };
}

export function fetchAdminAttendees(params?: { eventId?: string; tierId?: string; status?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params?.eventId) sp.set("eventId", params.eventId);
  if (params?.tierId) sp.set("tierId", params.tierId);
  if (params?.status) sp.set("status", params.status);
  if (params?.q) sp.set("q", params.q);
  const qs = sp.toString();
  return adminRequest<AdminAttendee[]>(`/ticketing/admin/attendees${qs ? `?${qs}` : ""}`);
}

export function checkInAttendee(ticketId: string) {
  return adminRequest<{ checkedIn: boolean; id: string; code: string; buyerName: string }>(
    `/ticketing/admin/tickets/${ticketId}/checkin`,
    { method: "POST" },
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface AdminPayment {
  id: string;
  bookingId: string;
  method: "CARD_GATEWAY" | "BANK_TRANSFER";
  status: "PENDING" | "CAPTURED" | "FAILED" | "MANUAL_REVIEW" | "REFUNDED";
  amountMinor: number;
  currency: string;
  providerRef: string | null;
  providerEventId: string | null;
  verifiedAt: string | null;
  createdAt: string;
  booking: {
    id: string;
    reference: string;
    buyerName: string;
    buyerEmail: string;
    buyerWhatsapp: string;
    status: string;
    event: { id: string; title: string; startsAt: string };
  };
}

export function fetchAllPayments() {
  return adminRequest<{ isSandbox: boolean; provider: string; items: AdminPayment[] }>("/payments/admin/list");
}

export function reconcilePayment(id: string) {
  return adminRequest<{ id: string; status: string }>(`/payments/${id}/reconcile`, {
    method: "POST",
  });
}

// ─── Organizers, Settlements & System Ops ─────────────────────────────────────

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
  return adminRequest<Organizer[]>("/organizers");
}

export function createOrganizer(payload: {
  name: string;
  contactEmail: string;
  contactPhone: string;
  commissionBps?: number;
  bankName?: string;
  bankAccount?: string;
}) {
  return adminRequest<Organizer>("/organizers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateOrganizer(
  id: string,
  payload: Partial<{
    name: string;
    contactEmail: string;
    contactPhone: string;
    commissionBps: number;
    bankName: string;
    bankAccount: string;
    isActive: boolean;
  }>,
) {
  return adminRequest<Organizer>(`/organizers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
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
  return adminRequest<Settlement[]>("/settlements");
}

export function calculateSettlement(payload: { eventId: string; organizerId: string }) {
  return adminRequest<Settlement>("/settlements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function approveSettlement(id: string) {
  return adminRequest<Settlement>(`/settlements/${id}/approve`, { method: "POST" });
}

export function markSettlementPaid(id: string) {
  return adminRequest<Settlement>(`/settlements/${id}/mark-paid`, { method: "POST" });
}

export function flushNotifications() {
  return adminRequest<{ processed: number; failed: number }>("/admin/notifications/flush", { method: "POST" });
}

export function fetchDeadLetters() {
  return adminRequest<Array<{ id: string; channel: string; recipient: string; template: string; attempts: number; createdAt: string }>>(
    "/admin/notifications/dead-letters",
  );
}

export function releaseExpiredHolds() {
  return adminRequest<{ released: number }>("/ticketing/admin/release-holds", { method: "POST" });
}
