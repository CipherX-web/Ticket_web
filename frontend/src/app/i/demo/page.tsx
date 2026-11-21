import type { Metadata } from "next";
import { fetchPublicInvitation } from "@/lib/api";
import { Invitation } from "./Invitation";

// Private by design: invitation pages must never be indexed.
export const metadata: Metadata = { title: "Invitation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DemoInvitation() {
  const data = await fetchPublicInvitation("demo");
  return (
    <Invitation
      token="demo"
      guestName={data?.guestName ?? "Dear Guest"}
      coupleTitle={data?.campaign.coupleTitle ?? "Amaya & Nuwan"}
      eventDate={data?.campaign.eventDate ?? "2027-02-14T10:00:00+05:30"}
      venueName={data?.campaign.venueName ?? "Sample Hall"}
      venueAddress={data?.campaign.venueAddress ?? "Galle Road, Colombo 03"}
      storyText={data?.campaign.storyText ?? "Together with our families, we warmly invite you to celebrate our wedding day in Colombo."}
      initialRsvp={data?.rsvpStatus === "ACCEPTED" ? "yes" : data?.rsvpStatus === "DECLINED" ? "no" : ""}
    />
  );
}
