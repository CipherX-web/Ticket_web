import { describe, expect, it } from "vitest";
import { products } from "@/data/products";
import { discountPct, estimate } from "./pricing";

const cards = products.find((p) => p.slug === "business-cards")!;

describe("estimate", () => {
  it("computes unit, discount and total in integer minor units", () => {
    const r = estimate(cards, { sizeId: "std", materialId: "350g", finishId: "matt", quantity: 500 })!;
    expect(r.unitMinor).toBe(2100);
    expect(r.subtotalMinor).toBe(1_050_000);
    expect(r.discountPct).toBe(10);
    expect(r.totalMinor).toBe(945_000);
    expect(Number.isInteger(r.totalMinor)).toBe(true);
  });
  it("rejects unknown options and invalid quantities", () => {
    expect(estimate(cards, { sizeId: "x", materialId: "350g", finishId: "none", quantity: 100 })).toBeNull();
    expect(estimate(cards, { sizeId: "std", materialId: "350g", finishId: "none", quantity: 10 })).toBeNull();
    expect(estimate(cards, { sizeId: "std", materialId: "350g", finishId: "none", quantity: 1.5 })).toBeNull();
    expect(estimate(cards, { sizeId: "std", materialId: "350g", finishId: "none", quantity: 1e9 })).toBeNull();
  });
  it("discount tiers are monotonic", () => {
    const q = [1, 250, 500, 1000, 5000].map(discountPct);
    expect([...q].sort((a, b) => a - b)).toEqual(q);
  });
});
