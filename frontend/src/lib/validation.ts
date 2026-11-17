import { z } from "zod";

export const guestSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email address").max(254),
  whatsapp: z.string().trim().regex(/^\+?\d[\d\s-]{8,14}$/, "Enter a valid WhatsApp number"),
});
export type GuestInput = z.infer<typeof guestSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.string().trim().email("Enter a valid email address").max(254),
  message: z.string().trim().min(10, "Tell us a little more (10+ characters)").max(2000),
});

export const trackSchema = z.object({
  reference: z.string().trim().regex(/^PX-[A-Z0-9]{6,10}$/i, "Reference looks like PX-ABC123"),
  email: z.string().trim().email("Enter the email used for the order").max(254),
});

/** Flatten zod issues into { field: message } for inline display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
