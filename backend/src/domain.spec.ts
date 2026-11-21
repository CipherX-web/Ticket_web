import { generateNumericOtp, generateToken, hashToken, signHmac, verifyHmac } from "@/common/crypto.util";
import { discountPctForQuantity } from "@/modules/commerce/commerce.module";

describe("crypto & commerce domain", () => {
  it("hashes tokens deterministically and verifies HMAC in constant time", () => {
    const t = generateToken(24);
    expect(t.length).toBeGreaterThanOrEqual(32);
    expect(hashToken(t)).toBe(hashToken(t));
    const sig = signHmac("payload-123", "secret-key");
    expect(verifyHmac("payload-123", sig, "secret-key")).toBe(true);
    expect(verifyHmac("payload-123", sig, "wrong-key")).toBe(false);
  });

  it("generates 6-digit OTPs", () => {
    const otp = generateNumericOtp(6);
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("computes monotonic volume discounts", () => {
    expect(discountPctForQuantity(100)).toBe(0);
    expect(discountPctForQuantity(250)).toBe(5);
    expect(discountPctForQuantity(500)).toBe(10);
    expect(discountPctForQuantity(1000)).toBe(15);
    expect(discountPctForQuantity(5000)).toBe(25);
  });
});
