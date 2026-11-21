"use client";
import { useState } from "react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { submitContact } from "@/lib/api";
import { contactSchema, fieldErrors } from "@/lib/validation";

export function ContactForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError("");
    const form = e.currentTarget;
    const parsed = contactSchema.safeParse(Object.fromEntries(new FormData(form)));
    setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;

    setLoading(true);
    try {
      await submitContact(parsed.data);
      setSent(true);
      form.reset();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-2 border border-line bg-paper p-6">
      <TextField label="Name" name="name" autoComplete="name" error={errors.name} />
      <TextField label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
      <TextField label="Message" name="message" textarea error={errors.message} />
      {serverError && <p role="alert" className="text-sm text-danger">{serverError}</p>}
      <Button type="submit" disabled={loading} className="w-full">{loading ? "Sending..." : "Send message"}</Button>
      {sent && (
        <p role="status" className="mt-3 border border-forest bg-sage-soft p-3 text-sm text-forest">
          Thank you — your message has been saved and our team will reply shortly.
        </p>
      )}
    </form>
  );
}
