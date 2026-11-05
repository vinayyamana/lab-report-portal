import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { db, withRetry } from "./db";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MOBILE_RE = /^[6-9]\d{9}$/;

export const isValidMobile = (m: string) => MOBILE_RE.test(m);

export async function issueOtp(mobile: string) {
  const code = String(randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 8);
  // invalidate older unused codes for this mobile
  await withRetry(() =>
    db.otpCode.updateMany({
      where: { mobile, usedAt: null },
      data: { usedAt: new Date() },
    })
  );
  await withRetry(() =>
    db.otpCode.create({
      data: { mobile, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    })
  );
  // MOCK SMS: in production send via SMS gateway. Never log in production.
  if (process.env.NODE_ENV !== "production") console.log(`[MOCK SMS] OTP for ${mobile}: ${code}`);
  return code;
}

export type VerifyResult = "ok" | "invalid" | "expired" | "locked";

export async function verifyOtp(mobile: string, code: string): Promise<VerifyResult> {
  const rec = await withRetry(() =>
    db.otpCode.findFirst({
      where: { mobile, usedAt: null },
      orderBy: { createdAt: "desc" },
    })
  );
  if (!rec) return "invalid";
  if (rec.expiresAt < new Date()) return "expired";
  if (rec.attempts >= MAX_ATTEMPTS) return "locked";

  const ok = await bcrypt.compare(code, rec.codeHash);
  if (!ok) {
    await db.otpCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    return "invalid";
  }
  await db.otpCode.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
  return "ok";
}