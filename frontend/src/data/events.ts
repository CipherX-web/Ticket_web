export type Tier = { id: string; name: string; priceMinor: number; available: number; perOrderMax: number };
export type EventItem = {
  slug: string;
  title: string;
  organizer: string;
  date: string; // ISO
  venue: string;
  city: string;
  summary: string;
  tiers: Tier[];
};

export const events: EventItem[] = [
  {
    slug: "colombo-jazz-night",
    title: "Colombo Jazz Night",
    organizer: "Lanka Live Productions",
    date: "2026-12-12T18:30:00+05:30",
    venue: "Open Air Theatre",
    city: "Colombo",
    summary: "An evening of live jazz with a quartet and guest vocalists. Gates open at 5:30 pm.",
    tiers: [
      { id: "general", name: "General admission", priceMinor: 250000, available: 120, perOrderMax: 6 },
      { id: "premium", name: "Premium seating", priceMinor: 450000, available: 40, perOrderMax: 4 },
      { id: "vip", name: "VIP table (4 seats)", priceMinor: 1500000, available: 0, perOrderMax: 1 },
    ],
  },
  {
    slug: "university-fest-2026",
    title: "University Fest 2026",
    organizer: "Student Union Events",
    date: "2027-01-24T14:00:00+05:30",
    venue: "Main Grounds",
    city: "Pannipitiya",
    summary: "A full-day campus festival with performances, food stalls and exhibitions.",
    tiers: [
      { id: "day", name: "Day pass", priceMinor: 100000, available: 800, perOrderMax: 10 },
      { id: "student", name: "Student pass", priceMinor: 70000, available: 500, perOrderMax: 4 },
    ],
  },
];

export const getEvent = (slug: string) => events.find((e) => e.slug === slug);
