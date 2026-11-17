import type { Metadata } from "next";
import { StudioWorkspace } from "./StudioWorkspace";

export const metadata: Metadata = {
  title: "Design Studio",
  description: "Interactive print proof and animated invitation studio.",
};

export default function StudioPage() {
  return <StudioWorkspace />;
}
