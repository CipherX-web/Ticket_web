import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateNumericOtp(digits = 6): string {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits;
  return String(randomInt(min, max));
}

export function signHmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyHmac(payload: string, signatureHex: string, secret: string): boolean {
  const expected = signHmac(payload, secret);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signatureHex, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateReference(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = `${prefix}-`;
  for (let i = 0; i < 6; i++) {
    out += chars[randomInt(0, chars.length)]!;
  }
  return out;
}
