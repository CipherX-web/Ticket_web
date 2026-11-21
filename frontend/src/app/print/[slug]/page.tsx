import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, products as fallbackProducts } from "@/data/products";
import { fetchProduct } from "@/lib/api";
import { Configurator } from "./Configurator";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return fallbackProducts.map((p) => ({ slug: p.slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = (await fetchProduct(slug)) ?? getProduct(slug);
  return { title: p ? p.name : "Product" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = (await fetchProduct(slug)) ?? getProduct(slug);
  if (!product) notFound();
  return (
    <div className="container-x py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link className="hover:text-forest" href="/print">Print</Link> / <span className="text-forest">{product.name}</span>
      </nav>
      <h1 className="mt-4 font-display text-4xl text-forest">{product.name}</h1>
      <p className="mt-2 max-w-2xl text-muted">{product.summary}</p>
      <Configurator product={product} />
    </div>
  );
}
