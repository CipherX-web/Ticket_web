import path from "node:path";
import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { hashToken } from "../src/common/crypto.util";

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 1. Seed Staff Admin (change password immediately in production)
  const adminHash = await argon2.hash("PrintX#Admin2026!", { type: argon2.argon2id });
  await prisma.staffUser.upsert({
    where: { email: "admin@printxads.lk" },
    update: {},
    create: {
      email: "admin@printxads.lk",
      name: "Print X Super Admin",
      passwordHash: adminHash,
      role: "SUPER_ADMIN",
    },
  });

  // 2. Seed Print Products
  const products = [
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

  for (const p of products) {
    await prisma.product.upsert({ where: { slug: p.slug }, update: p, create: p });
  }

  // 3. Seed Organizers & Events
  const org1 = await prisma.organizer.upsert({
    where: { id: "org-lanka-live" },
    update: {},
    create: {
      id: "org-lanka-live",
      name: "Lanka Live Productions",
      contactEmail: "hello@lankalive.lk",
      contactPhone: "+94771002000",
      commissionBps: 1000,
    },
  });

  const org2 = await prisma.organizer.upsert({
    where: { id: "org-student-union" },
    update: {},
    create: {
      id: "org-student-union",
      name: "Student Union Events",
      contactEmail: "events@su.lk",
      contactPhone: "+94772003000",
      commissionBps: 800,
    },
  });

  const jazz = await prisma.event.upsert({
    where: { slug: "colombo-jazz-night" },
    update: {},
    create: {
      slug: "colombo-jazz-night",
      title: "Colombo Jazz Night",
      organizerId: org1.id,
      startsAt: new Date("2026-12-12T18:30:00+05:30"),
      venue: "Open Air Theatre",
      city: "Colombo",
      summary: "An evening of live jazz with a quartet and guest vocalists. Gates open at 5:30 pm.",
      approvalMode: "AUTOMATIC",
      isPublished: true,
    },
  });

  for (const tier of [
    { code: "general", name: "General admission", priceMinor: 250000, capacity: 150, available: 120, perOrderMax: 6 },
    { code: "premium", name: "Premium seating", priceMinor: 450000, capacity: 50, available: 40, perOrderMax: 4 },
    { code: "vip", name: "VIP table (4 seats)", priceMinor: 1500000, capacity: 10, available: 0, perOrderMax: 1 },
  ]) {
    await prisma.ticketTier.upsert({
      where: { eventId_code: { eventId: jazz.id, code: tier.code } },
      update: {},
      create: { eventId: jazz.id, ...tier },
    });
  }

  const fest = await prisma.event.upsert({
    where: { slug: "university-fest-2026" },
    update: {},
    create: {
      slug: "university-fest-2026",
      title: "University Fest 2026",
      organizerId: org2.id,
      startsAt: new Date("2027-01-24T14:00:00+05:30"),
      venue: "Main Grounds",
      city: "Pannipitiya",
      summary: "A full-day campus festival with performances, food stalls and exhibitions.",
      approvalMode: "AUTOMATIC",
      isPublished: true,
    },
  });

  for (const tier of [
    { code: "day", name: "Day pass", priceMinor: 100000, capacity: 800, available: 800, perOrderMax: 10 },
    { code: "student", name: "Student pass", priceMinor: 70000, capacity: 500, available: 500, perOrderMax: 4 },
  ]) {
    await prisma.ticketTier.upsert({
      where: { eventId_code: { eventId: fest.id, code: tier.code } },
      update: {},
      create: { eventId: fest.id, ...tier },
    });
  }

  // 4. Seed Sample Invitation Campaign & Demo Guest Token
  const campaign = await prisma.invitationCampaign.upsert({
    where: { slug: "amaya-and-nuwan" },
    update: {},
    create: {
      slug: "amaya-and-nuwan",
      coupleTitle: "Amaya & Nuwan",
      eventDate: new Date("2027-02-14T10:00:00+05:30"),
      venueName: "Sample Hall",
      venueAddress: "Galle Road, Colombo 03",
      storyText: "Together with our families, we warmly invite you to celebrate our wedding day in Colombo.",
      templateConfig: { accentHex: "#D4A853", tone: "studio" },
      isPublished: true,
    },
  });

  await prisma.invitationGuest.upsert({
    where: { tokenHash: hashToken("demo") },
    update: {},
    create: {
      campaignId: campaign.id,
      guestName: "Dear Guest",
      tokenHash: hashToken("demo"),
      maxPartySize: 2,
    },
  });

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
