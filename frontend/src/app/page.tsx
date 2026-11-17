import { ButtonLink } from "@/components/Button";
import { Placeholder } from "@/components/Placeholder";
import { Reveal } from "@/components/Reveal";

const services = [
  {
    href: "/events",
    img: "/images/event-live.jpg",
    tag: "Box Office",
    title: "Event tickets",
    text: "Buy tickets as a guest with no account required. Instant QR passes delivered via email and WhatsApp.",
    cta: "Find events",
  },
  {
    href: "/print",
    img: "/images/print-craft.jpg",
    tag: "Commercial Print",
    title: "Print shop",
    text: "Configure size, stock, and finish with live LKR estimates. Upload artwork and approve your proof before printing.",
    cta: "Browse products",
  },
  {
    href: "/invitations",
    img: "/images/invite-craft.jpg",
    tag: "Digital Suite",
    title: "Wedding invitations",
    text: "Animated, personally addressed invitation pages with live countdowns, venue maps, and guest RSVP tracking.",
    cta: "Explore invitations",
  },
];

const steps = [
  { n: "01", t: "Choose", d: "Pick an event, print product, or invitation theme." },
  { n: "02", t: "Configure in Studio", d: "See LKR pricing instantly. Customize specs or preview your invitation live." },
  { n: "03", t: "Approve", d: "Sign off on your print proof before production starts, or confirm your tickets." },
  { n: "04", t: "Receive", d: "Track production, collect your print order, or open your QR tickets." },
];

export default function Home() {
  return (
    <>
      {/* First-Look Studio Hero */}
      <section className="studio-grid border-b border-studio-line bg-studio text-white">
        <div className="container-x grid items-center gap-10 py-14 md:grid-cols-[1.05fr_1fr] md:py-20">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-gold">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              Ticketing · Print Studio · Invitations
            </p>
            <h1 className="mt-4 font-display text-4xl leading-[1.08] text-white md:text-6xl">
              Tickets, print, and invitations — built to studio standard.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70 md:text-lg">
              Book live event passes without an account, configure commercial print jobs with proof sign-off, and craft animated invitations in one workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/events" variant="primary">Browse Events</ButtonLink>
              <ButtonLink href="/studio" variant="secondary-light">Open Design Studio</ButtonLink>
              <ButtonLink href="/print" variant="secondary-light">Print Shop</ButtonLink>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-studio-line pt-6 text-xs">
              <div>
                <dt className="text-white/50">Checkout</dt>
                <dd className="mt-1 font-medium text-white">Guest QR · No login</dd>
              </div>
              <div>
                <dt className="text-white/50">Production</dt>
                <dd className="mt-1 font-medium text-white">Proof-first approval</dd>
              </div>
              <div>
                <dt className="text-white/50">Currency</dt>
                <dd className="mt-1 font-medium text-white">Sri Lanka · LKR</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-3">
            <Placeholder
              src="/images/hero-main.jpg"
              priority
              label="Print X studio desk featuring event tickets, foil passes, and commercial print proofs"
              className="aspect-[4/3] w-full border-studio-line"
            />
            <div className="flex items-center justify-between border border-studio-line bg-studio-panel px-4 py-2.5 text-xs text-white/65">
              <span>Print X Studio · Colombo</span>
              <span className="text-gold">300 DPI · CMYK · Verified QR</span>
            </div>
          </div>
        </div>
      </section>

      {/* Three Core Experiences */}
      <section className="container-x py-16 md:py-24" aria-labelledby="services-h">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Platform</p>
            <h2 id="services-h" className="mt-2 font-display text-3xl text-forest md:text-4xl">Three services, one studio</h2>
          </div>
          <ButtonLink href="/studio" variant="secondary">Launch Interactive Studio</ButtonLink>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {services.map((s, i) => (
            <Reveal key={s.href} delay={i * 80} className="flex flex-col border border-line bg-paper">
              <Placeholder src={s.img} label={s.title} className="aspect-[16/10] border-0 border-b border-line" />
              <div className="flex flex-1 flex-col p-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">{s.tag}</p>
                <h3 className="mt-2 font-display text-2xl text-forest">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.text}</p>
                <ButtonLink href={s.href} variant="ghost" className="mt-5 -ml-5 self-start">{s.cta} →</ButtonLink>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="border-y border-line bg-paper" aria-labelledby="how-h">
        <div className="container-x grid gap-10 py-16 md:grid-cols-[1fr_2fr] md:py-24">
          <div className="md:sticky md:top-28 md:self-start">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Workflow</p>
            <h2 id="how-h" className="mt-2 font-display text-3xl text-forest">How it works</h2>
            <p className="mt-3 text-muted">Clear steps, live status, and zero guesswork from checkout to delivery.</p>
          </div>
          <ol className="divide-y divide-line border-y border-line">
            {steps.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 60} className="flex gap-6 py-7">
                <span className="font-display text-2xl text-accent">{s.n}</span>
                <div>
                  <h3 className="text-lg font-medium text-forest">{s.t}</h3>
                  <p className="mt-1 text-muted">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Studio Samples / Recent Work */}
      <section className="container-x py-16 md:py-24" aria-labelledby="work-h">
        <h2 id="work-h" className="font-display text-3xl text-forest">Print &amp; pass formats</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ["Booklets", "booklets"],
            ["Banners", "banners"],
            ["Business cards", "business-cards"],
            ["Stickers", "stickers"],
          ].map(([l, s], i) => (
            <Reveal key={s} delay={i * 70}>
              <Placeholder src={`/temp/${s}.svg`} label={l!} className="aspect-square" />
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
