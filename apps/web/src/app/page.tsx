import { ButtonLink } from "@/components/Button";
import { Placeholder } from "@/components/Placeholder";
import { Reveal } from "@/components/Reveal";

const services = [
  { href: "/print", title: "Print shop", text: "Configure size, material and finish. Upload artwork, approve a proof, track production.", cta: "Browse products" },
  { href: "/events", title: "Event tickets", text: "Buy tickets as a guest. No account needed. QR tickets delivered by email and WhatsApp.", cta: "Find events" },
  { href: "/invitations", title: "Wedding invitations", text: "Personal, animated invitation pages with RSVP, venue map and a private link per guest.", cta: "View invitations" },
];
const steps = [
  { n: "01", t: "Choose", d: "Pick a product, event or invitation style." },
  { n: "02", t: "Configure", d: "See an estimate instantly. Upload artwork or enter guest details." },
  { n: "03", t: "Approve", d: "Approve a proof before any print starts, or confirm your tickets." },
  { n: "04", t: "Receive", d: "Track production, collect your order, or open your QR tickets." },
];

export default function Home() {
  return (
    <>
      <section className="border-b border-line">
        <div className="container-x grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-forest/70">Print · Events · Invitations</p>
            <h1 className="mt-4 font-display text-4xl leading-[1.1] text-forest md:text-6xl">Print, tickets and invitations — handled properly.</h1>
            <p className="mt-6 max-w-lg text-lg text-muted">One platform for your print jobs, event bookings and wedding invitations, with clear pricing and status at every step.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/print">Start a print order</ButtonLink>
              <ButtonLink href="/events" variant="secondary">Find events</ButtonLink>
            </div>
          </div>
          <Placeholder src="/temp/hero.svg" label="Hero image — studio print work" className="aspect-[4/3] w-full" />
        </div>
      </section>

      <section className="container-x py-16 md:py-24" aria-labelledby="services-h">
        <h2 id="services-h" className="font-display text-3xl text-forest">What we do</h2>
        <div className="mt-8 grid gap-px border border-line bg-line md:grid-cols-3">
          {services.map((s, i) => (
            <Reveal key={s.href} delay={i * 90} className="bg-paper p-8">
              <h3 className="font-display text-2xl text-forest">{s.title}</h3>
              <p className="mt-3 min-h-24 text-muted">{s.text}</p>
              <ButtonLink href={s.href} variant="ghost" className="mt-4 -ml-5">{s.cta} →</ButtonLink>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-paper border-y border-line" aria-labelledby="how-h">
        <div className="container-x grid gap-10 py-16 md:grid-cols-[1fr_2fr] md:py-24">
          <div className="md:sticky md:top-28 md:self-start">
            <h2 id="how-h" className="font-display text-3xl text-forest">How it works</h2>
            <p className="mt-3 text-muted">Four steps, the same for every service.</p>
          </div>
          <ol className="divide-y divide-line border-y border-line">
            {steps.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 60} className="flex gap-6 py-8">
                <span className="font-display text-2xl text-gold">{s.n}</span>
                <div><h3 className="text-lg font-medium text-forest">{s.t}</h3><p className="mt-1 text-muted">{s.d}</p></div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-x py-16 md:py-24" aria-labelledby="work-h">
        <h2 id="work-h" className="font-display text-3xl text-forest">Recent work</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[["Booklets", "booklets"], ["Banners", "banners"], ["Business cards", "business-cards"], ["Stickers", "stickers"]].map(([l, s], i) => (
            <Reveal key={s} delay={i * 70}><Placeholder src={`/temp/${s}.svg`} label={l!} className="aspect-square" /></Reveal>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">Temporary illustrations. Replace with real, compressed photography of finished jobs.</p>
      </section>
    </>
  );
}
