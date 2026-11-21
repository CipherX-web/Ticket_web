"use client";
import { useState } from "react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { approvePrintProof, trackPrintOrder } from "@/lib/api";
import { formatLkr } from "@/lib/format";
import { fieldErrors, trackSchema } from "@/lib/validation";

export function TrackForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [creds, setCreds] = useState<{ reference: string; email: string } | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof trackPrintOrder>> | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError("");
    const parsed = trackSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;

    setLoading(true);
    try {
      const res = await trackPrintOrder(parsed.data.reference, parsed.data.email);
      setCreds(parsed.data);
      setResult(res);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!creds) return;
    setLoading(true);
    try {
      await approvePrintProof(creds.reference, creds.email);
      const updated = await trackPrintOrder(creds.reference, creds.email);
      setResult(updated);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not approve proof.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 border border-line bg-paper p-6">
      <TextField label="Order reference" name="reference" placeholder="PX-ABC123" autoCapitalize="characters" error={errors.reference} />
      <TextField label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
      {serverError && <p role="alert" className="text-sm text-danger">{serverError}</p>}
      <Button type="submit" disabled={loading} className="w-full">{loading ? "Checking..." : "Check status"}</Button>

      {result && (
        <div role="status" className="mt-3 border border-line bg-sage-soft p-4 text-sm text-forest">
          {!result.found ? (
            <p>{result.message}</p>
          ) : (
            <div className="space-y-2">
              <p className="font-medium">{result.reference} · {result.status}</p>
              <p>{result.productName} × {result.quantity} — {formatLkr(result.totalMinor ?? 0)}</p>
              {result.approvedAt ? (
                <p className="text-xs text-muted">Proof approved on {new Date(result.approvedAt).toLocaleString()}</p>
              ) : result.proofRequired ? (
                <Button type="button" variant="dark" onClick={handleApprove} className="mt-2">
                  Approve Print Proof
                </Button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
