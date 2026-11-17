import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { TrackForm } from "./TrackForm";

export const metadata: Metadata = { title: "Track an order" };

export default function TrackPage() {
  return (
    <>
      <PageHeader eyebrow="Order status" title="Track an order">Enter your order reference and the email used when ordering.</PageHeader>
      <div className="container-x grid gap-10 py-12 md:grid-cols-2">
        <TrackForm />
        <ol className="self-start border border-line bg-paper p-6 text-sm" aria-label="Production stages">
          <li className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-forest/70">Production stages</li>
          {["New", "Artwork review", "Awaiting proof approval", "Ready to print", "Printing", "Ready", "Delivered"].map((s, i) => (
            <li key={s} className="flex items-center gap-3 border-t border-line py-2">
              <span className="w-6 text-gold">{String(i + 1).padStart(2, "0")}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
