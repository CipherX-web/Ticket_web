"use client";
import type { ReactNode } from "react";

const statusStyles: Record<string, string> = {
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CAPTURED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  VALID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CHECKED_IN: "bg-sky-50 text-sky-700 border-sky-200",
  PENDING_PAYMENT: "bg-amber-50 text-amber-700 border-amber-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_MANUAL_REVIEW: "bg-amber-50 text-amber-800 border-amber-200",
  MANUAL_REVIEW: "bg-amber-50 text-amber-800 border-amber-200",
  DRAFT: "bg-sage-soft text-muted border-line",
  CANCELLED: "bg-red-50 text-danger border-red-200",
  FAILED: "bg-red-50 text-danger border-red-200",
  REFUNDED: "bg-sage-soft text-muted border-line",
  INACTIVE: "bg-red-50 text-danger border-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toUpperCase();
  const cls = statusStyles[key] ?? "bg-sage-soft text-muted border-line";
  return (
    <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-sm border border-line bg-paper p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold ${accent ? "text-accent" : "text-forest"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function AdminModal({
  title,
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-sm border border-line bg-paper p-6 shadow-xl`}>
        <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
          <h2 className="font-display text-xl text-forest">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-sm p-1 text-muted hover:bg-sage-soft hover:text-forest"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ToastBanner({
  message,
  type = "success",
  onDismiss,
}: {
  message: string;
  type?: "success" | "error";
  onDismiss: () => void;
}) {
  if (!message) return null;
  const cls =
    type === "error"
      ? "border-red-300 bg-red-50 text-danger"
      : "border-emerald-300 bg-emerald-50 text-emerald-800";
  return (
    <div role="status" className={`flex items-center justify-between rounded-sm border px-4 py-3 text-sm ${cls}`}>
      <span>{message}</span>
      <button type="button" onClick={onDismiss} className="ml-4 text-xs font-semibold hover:opacity-70">
        Dismiss
      </button>
    </div>
  );
}
