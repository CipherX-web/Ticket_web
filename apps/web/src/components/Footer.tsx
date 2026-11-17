import Link from "next/link";

const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "94000000000";

export function Footer() {
  return (
    <footer className="mt-24 bg-forest-deep text-ivory/85">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-xl tracking-[0.18em] text-ivory">PRINT <span className="text-gold">X</span></p>
          <p className="mt-3 max-w-sm text-sm text-ivory/70">Print, event tickets and animated invitations — one reliable platform, built in Sri Lanka.</p>
        </div>
        <nav aria-label="Services">
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Services</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/print">Print shop</Link></li>
            <li><Link className="hover:text-white" href="/events">Event tickets</Link></li>
            <li><Link className="hover:text-white" href="/invitations">Invitations</Link></li>
            <li><Link className="hover:text-white" href="/track">Track an order</Link></li>
          </ul>
        </nav>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Contact</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a className="hover:text-white" href={`https://wa.me/${wa}`} rel="noopener noreferrer" target="_blank">WhatsApp</a></li>
            <li><Link className="hover:text-white" href="/contact">Send a message</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-ivory/60 md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} Print X. All rights reserved.</p>
          <p>Prices in LKR. Online prices are estimates until confirmed.</p>
        </div>
      </div>
    </footer>
  );
}
