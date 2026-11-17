import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { Placeholder } from "@/components/Placeholder";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = { title: "Wedding invitations" };

const features = [
  { t: "Animated, not static", d: "An envelope opens into a sequence of scenes: names, story, gallery, venue and RSVP." },
  { t: "Personal for every guest", d: "Each guest gets a private link that shows their own name and their own invitation." },
  { t: "RSVP and tracking", d: "Guests reply in one tap. You see responses, party sizes and who has opened." },
  { t: "Fast on any phone", d: "Lightweight pages, lazy-loaded media and a calm fallback for reduced-motion settings." },
];

export default function InvitationsPage() {
  return (
    <>
      <PageHeader eyebrow="E-invitations" title="Wedding invitations that feel personal">
        Interactive invitation pages with RSVP and map directions, sent as private links.
      </PageHeader>
      <div className="container-x grid gap-10 py-12 md:grid-cols-2">
        <div>
          <Placeholder src="/temp/invitation.svg" label="Invitation preview" className="aspect-[3/4] max-w-sm" />
          <ButtonLink href="/i/demo" className="mt-6">Open the sample invitation</ButtonLink>
        </div>
        <ul className="divide-y divide-line border-y border-line self-start">
          {features.map((f, i) => (
            <Reveal as="li" key={f.t} delay={i * 70} className="py-6">
              <h2 className="font-display text-xl text-forest">{f.t}</h2>
              <p className="mt-1 text-muted">{f.d}</p>
            </Reveal>
          ))}
        </ul>
      </div>
      <div className="container-x pb-4">
        <p className="border border-line bg-paper p-5 text-sm text-muted">
          Ready to order? Print X creates your invitation, imports your guest list and delivers the links. <a className="text-forest underline" href="/contact">Contact us</a> to get started.
        </p>
      </div>
    </>
  );
}
