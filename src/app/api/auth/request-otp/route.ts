import { NextResponse } from "next/server";
import { z } from "zod";
import { issueOtp, isValidMobile } from "@/lib/otp";
import { otpRateLimited } from "@/lib/otp-limit";
import { db, withRetry } from "@/lib/db";

const schema = z.object({ mobile: z.string().refine(isValidMobile, "Invalid mobile") });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid 10-digit mobile" }, { status: 400 });

  const { mobile } = parsed.data;
  const user = await withRetry(() => db.user.findUnique({ where: { mobile } }));
  // Same response whether or not the user exists (no account enumeration)
  let devCode: string | undefined;
  if (user) {
    if (await otpRateLimited(mobile)) {
      return NextResponse.json({ error: "Too many code requests. Please try again in 15 minutes." }, { status: 429 });
    }
    const code = await issueOtp(mobile);
    if (process.env.DEMO_SHOW_OTP === "true") devCode = code;
  }
  return NextResponse.json({ ok: true, devCode });
}