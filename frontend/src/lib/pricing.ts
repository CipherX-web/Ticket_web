import type { Option, Product } from "@/data/products";

export type Selection = { sizeId: string; materialId: string; finishId: string; quantity: number };
export type Estimate = { unitMinor: number; subtotalMinor: number; discountPct: number; totalMinor: number };

const find = (list: Option[], id: string) => list.find((o) => o.id === id);

/** Volume discount tiers: larger runs cost less per unit. */
export function discountPct(quantity: number): number {
  if (quantity >= 5000) return 25;
  if (quantity >= 1000) return 15;
  if (quantity >= 500) return 10;
  if (quantity >= 250) return 5;
  return 0;
}

/**
 * Indicative estimate only. Final price is confirmed server-side / by staff.
 * Returns null for invalid selections (never throws on user input).
 */
export function estimate(product: Product, sel: Selection): Estimate | null {
  const size = find(product.sizes, sel.sizeId);
  const material = find(product.materials, sel.materialId);
  const finish = find(product.finishes, sel.finishId);
  if (!size || !material || !finish) return null;
  if (!Number.isInteger(sel.quantity) || sel.quantity < product.minQty || sel.quantity > 100000) return null;

  const unitMinor = Math.round(
    product.baseUnitMinor * (size.factor ?? 1) * (material.factor ?? 1) + (finish.addPerUnitMinor ?? 0),
  );
  const subtotalMinor = unitMinor * sel.quantity;
  const pct = discountPct(sel.quantity);
  const totalMinor = Math.round((subtotalMinor * (100 - pct)) / 100);
  return { unitMinor, subtotalMinor, discountPct: pct, totalMinor };
}
