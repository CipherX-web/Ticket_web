import { describe, expect, it } from "vitest";
import { contactSchema, guestSchema, trackSchema } from "./validation";

describe("validation", () => {
  it("accepts a valid guest and rejects bad email/phone", () => {
    expect(guestSchema.safeParse({ name: "Nimali Perera", email: "n@example.com", whatsapp: "+94 77 123 4567" }).success).toBe(true);
    expect(guestSchema.safeParse({ name: "N", email: "bad", whatsapp: "abc" }).success).toBe(false);
  });
  it("rejects over-long input", () => {
    expect(contactSchema.safeParse({ name: "Ann", email: "a@b.co", message: "x".repeat(2001) }).success).toBe(false);
  });
  it("validates order reference format", () => {
    expect(trackSchema.safeParse({ reference: "PX-ABC123", email: "a@b.co" }).success).toBe(true);
    expect(trackSchema.safeParse({ reference: "1; DROP TABLE", email: "a@b.co" }).success).toBe(false);
  });
});
