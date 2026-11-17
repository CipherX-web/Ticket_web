import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = { title: "Contact" };
const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "94000000000";

export default function ContactPage() {
  return (
    <>
      <PageHeader eyebrow="Contact" title="Talk to Print X">Quotes, bulk jobs, invitations or event questions.</PageHeader>
      <div className="container-x grid gap-10 py-12 md:grid-cols-[1.2fr_1fr]">
        <ContactForm />
        <aside className="self-start border border-line bg-paper p-6 text-sm">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-forest/70">Fastest way</h2>
          <p className="mt-3 text-muted">Message us on WhatsApp and include your order or product reference.</p>
          <a className="mt-4 inline-block border border-forest px-5 py-3 text-forest hover:bg-forest hover:text-ivory" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">Open WhatsApp</a>
          <p className="mt-6 text-xs text-muted">Contact details and opening hours will be added after business confirmation.</p>
        </aside>
      </div>
    </>
  );
}
