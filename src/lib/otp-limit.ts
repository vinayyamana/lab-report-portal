import { db, withRetry } from "./db";

// At most 3 OTP requests per mobile in 15 minutes.
export const OTP_WINDOW_MS = 15 * 60 * 1000;
export const OTP_MAX_REQUESTS = 3;

export async function otpRateLimited(mobile: string, now = Date.now()): Promise<boolean> {
  const recent = await withRetry(() =>
    db.otpCode.count({
      where: { mobile, createdAt: { gte: new Date(now - OTP_WINDOW_MS) } },
    })
  );
  return recent >= OTP_MAX_REQUESTS;
}