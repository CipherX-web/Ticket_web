import type { Metadata } from "next";
import { Invitation } from "./Invitation";

// Private by design: invitation pages must never be indexed.
export const metadata: Metadata = { title: "Invitation", robots: { index: false, follow: false } };

export default function DemoInvitation() {
  return <Invitation guestName="Dear Guest" />;
}
