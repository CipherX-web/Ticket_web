"use client";
import { useState } from "react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { fieldErrors, trackSchema } from "@/lib/validation";

export function TrackForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = trackSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    setSent(parsed.success);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-2 border border-line bg-paper p-6">
      <TextField label="Order reference" name="reference" placeholder="PX-ABC123" autoCapitalize="characters" error={errors.reference} />
      <TextField label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
      <Button type="submit" className="w-full">Check status</Button>
      {sent && (
        <p role="status" className="mt-3 border border-sage bg-sage-soft p-3 text-sm text-forest">
          Preview only. Order lookup connects in the print commerce phase. To protect privacy, the live version never reveals whether a reference exists.
        </p>
      )}
    </form>
  );
}
