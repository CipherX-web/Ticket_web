"use client";
import { useState } from "react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { contactSchema, fieldErrors } from "@/lib/validation";

export function ContactForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = contactSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    setSent(parsed.success);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-2 border border-line bg-paper p-6">
      <TextField label="Name" name="name" autoComplete="name" error={errors.name} />
      <TextField label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
      <TextField label="Message" name="message" textarea error={errors.message} />
      <Button type="submit" className="w-full">Send message</Button>
      {sent && (
        <p role="status" className="mt-3 border border-sage bg-sage-soft p-3 text-sm text-forest">
          Preview only. The form is not connected to a server yet, so nothing was sent. Please use WhatsApp for now.
        </p>
      )}
    </form>
  );
}
