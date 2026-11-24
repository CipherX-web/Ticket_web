import { Suspense } from "react";
import Link from "next/link";
import { CheckoutReturnContent } from "./CheckoutReturnContent";

export default function CheckoutReturnPage() {
  return (
    <main className="container-x py-14 max-w-xl">
      <Suspense fallback={<div className="p-8 text-center text-muted">Checking payment status…</div>}>
        <CheckoutReturnContent />
      </Suspense>
    </main>
  );
}
