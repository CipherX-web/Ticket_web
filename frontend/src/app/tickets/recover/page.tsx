import type { Metadata } from "next";
import { RecoveryFlow } from "./RecoveryFlow";

export const metadata: Metadata = { title: "Recover your tickets" };

export default function TicketRecoveryPage() {
  return (
    <div className="container-x py-12 max-w-lg">
      <RecoveryFlow />
    </div>
  );
}
