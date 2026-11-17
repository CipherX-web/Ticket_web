import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Placeholder } from "@/components/Placeholder";
import { products } from "@/data/products";
import { formatLkr } from "@/lib/format";

export const metadata: Metadata = { title: "Print products" };

export default function PrintPage() {
  const categories = [...new Set(products.map((p) => p.category))];
  return (
    <>
      <PageHeader eyebrow="Print shop" title="Print products">Choose a product to configure size, material and finish and see an estimate.</PageHeader>
      <div className="container-x py-12">
        {categories.map((c) => (
          <section key={c} className="mb-12" aria-labelledby={`c-${c}`}>
            <h2 id={`c-${c}`} className="mb-4 border-b border-line pb-2 text-sm font-medium uppercase tracking-[0.18em] text-forest/70">{c}</h2>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.filter((p) => p.category === c).map((p) => (
                <li key={p.slug}>
                  <Link href={`/print/${p.slug}`} className="group block border border-line bg-paper transition-colors hover:border-forest">
                    <Placeholder src={`/temp/${p.slug}.svg`} label={p.name} className="aspect-[4/3] border-0 border-b" />
                    <div className="p-5">
                      <h3 className="font-display text-xl text-forest">{p.name}</h3>
                      <p className="mt-1 text-sm text-muted">{p.summary}</p>
                      <p className="mt-4 text-sm text-forest">From {formatLkr(p.baseUnitMinor * p.minQty)} <span className="text-muted">· min {p.minQty}</span></p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="border border-line bg-paper p-5 text-sm text-muted">Need something unusual or a large bulk run? Request a staff quotation from the <Link className="text-forest underline" href="/contact">contact page</Link>.</p>
      </div>
    </>
  );
}
