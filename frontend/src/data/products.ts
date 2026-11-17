export type Option = { id: string; label: string; factor?: number; addPerUnitMinor?: number };

export type Product = {
  slug: string;
  name: string;
  category: "Business" | "Marketing" | "Large format" | "Stationery";
  summary: string;
  baseUnitMinor: number; // LKR in minor units (cents) per unit at the reference size
  minQty: number;
  quantities: number[];
  sizes: Option[];
  materials: Option[];
  finishes: Option[];
  proofRequired: boolean;
  leadTime: string;
};

export const products: Product[] = [
  {
    slug: "business-cards",
    name: "Business cards",
    category: "Business",
    summary: "Premium stocks, crisp edges, consistent colour.",
    baseUnitMinor: 1800,
    minQty: 100,
    quantities: [100, 250, 500, 1000],
    sizes: [{ id: "std", label: "90 × 55 mm", factor: 1 }, { id: "sq", label: "65 × 65 mm", factor: 1.1 }],
    materials: [
      { id: "350g", label: "350gsm art card", factor: 1 },
      { id: "kraft", label: "Kraft board", factor: 1.2 },
      { id: "soft", label: "Soft-touch laminated", factor: 1.5 },
    ],
    finishes: [
      { id: "none", label: "No finish", addPerUnitMinor: 0 },
      { id: "matt", label: "Matt lamination", addPerUnitMinor: 300 },
      { id: "spot", label: "Spot UV", addPerUnitMinor: 800 },
    ],
    proofRequired: true,
    leadTime: "3 working days",
  },
  {
    slug: "flyers",
    name: "Flyers & handbills",
    category: "Marketing",
    summary: "Single or double sided, short and bulk runs.",
    baseUnitMinor: 2500,
    minQty: 100,
    quantities: [100, 500, 1000, 5000],
    sizes: [
      { id: "a5", label: "A5", factor: 1 },
      { id: "a4", label: "A4", factor: 1.9 },
      { id: "dl", label: "DL", factor: 0.8 },
    ],
    materials: [
      { id: "130g", label: "130gsm gloss", factor: 1 },
      { id: "170g", label: "170gsm matt", factor: 1.25 },
    ],
    finishes: [{ id: "none", label: "No finish", addPerUnitMinor: 0 }, { id: "fold", label: "Single fold", addPerUnitMinor: 400 }],
    proofRequired: true,
    leadTime: "2–4 working days",
  },
  {
    slug: "posters",
    name: "Posters",
    category: "Marketing",
    summary: "Event, promotion and display posters.",
    baseUnitMinor: 18000,
    minQty: 1,
    quantities: [1, 10, 50, 100],
    sizes: [{ id: "a3", label: "A3", factor: 1 }, { id: "a2", label: "A2", factor: 1.9 }, { id: "a1", label: "A1", factor: 3.4 }],
    materials: [{ id: "170g", label: "170gsm silk", factor: 1 }, { id: "250g", label: "250gsm satin", factor: 1.35 }],
    finishes: [{ id: "none", label: "No finish", addPerUnitMinor: 0 }, { id: "lam", label: "Lamination", addPerUnitMinor: 6000 }],
    proofRequired: true,
    leadTime: "2 working days",
  },
  {
    slug: "banners",
    name: "Vinyl banners",
    category: "Large format",
    summary: "Indoor and outdoor banners, hemmed and eyeleted.",
    baseUnitMinor: 120000,
    minQty: 1,
    quantities: [1, 2, 5, 10],
    sizes: [
      { id: "2x4", label: "2 × 4 ft", factor: 1 },
      { id: "3x6", label: "3 × 6 ft", factor: 2.25 },
      { id: "4x8", label: "4 × 8 ft", factor: 4 },
    ],
    materials: [{ id: "pvc", label: "PVC flex 440gsm", factor: 1 }, { id: "mesh", label: "Mesh vinyl", factor: 1.3 }],
    finishes: [{ id: "hem", label: "Hem + eyelets", addPerUnitMinor: 0 }, { id: "pole", label: "Pole pockets", addPerUnitMinor: 25000 }],
    proofRequired: true,
    leadTime: "2–3 working days",
  },
  {
    slug: "stickers",
    name: "Stickers & labels",
    category: "Stationery",
    summary: "Die-cut and kiss-cut, waterproof options.",
    baseUnitMinor: 900,
    minQty: 50,
    quantities: [50, 200, 500, 1000],
    sizes: [{ id: "50", label: "50 × 50 mm", factor: 1 }, { id: "75", label: "75 × 75 mm", factor: 1.8 }],
    materials: [{ id: "paper", label: "Gloss paper", factor: 1 }, { id: "vinyl", label: "Waterproof vinyl", factor: 1.6 }],
    finishes: [{ id: "kiss", label: "Kiss-cut", addPerUnitMinor: 0 }, { id: "die", label: "Die-cut", addPerUnitMinor: 250 }],
    proofRequired: true,
    leadTime: "3–4 working days",
  },
  {
    slug: "booklets",
    name: "Booklets & notes",
    category: "Stationery",
    summary: "Tutorials, notes and profile books. Quote required for bulk.",
    baseUnitMinor: 45000,
    minQty: 20,
    quantities: [20, 50, 100, 250],
    sizes: [{ id: "a5", label: "A5, 40 pages", factor: 1 }, { id: "a4", label: "A4, 40 pages", factor: 1.8 }],
    materials: [{ id: "80g", label: "80gsm bond", factor: 1 }, { id: "100g", label: "100gsm matt", factor: 1.2 }],
    finishes: [{ id: "stitch", label: "Saddle stitch", addPerUnitMinor: 0 }, { id: "perfect", label: "Perfect bound", addPerUnitMinor: 15000 }],
    proofRequired: true,
    leadTime: "5 working days",
  },
];

export const getProduct = (slug: string) => products.find((p) => p.slug === slug);
