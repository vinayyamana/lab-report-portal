import { NextResponse } from "next/server";
import { lookupLink, maskMobile } from "@/lib/links";
import { issueOtp } from "@/lib/otp";
import { otpRateLimited } from "@/lib/otp-limit";

export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await lookupLink(token);
  if (r.status !== "ok") return NextResponse.json({ error: r.status }, { status: 410 });
  if (await otpRateLimited(r.mobile)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const code = await issueOtp(r.mobile); // sent ONLY to the owner's mobile
  return NextResponse.json({
    ok: true,
    sentTo: maskMobile(r.mobile),
    devCode: process.env.DEMO_SHOW_OTP === "true" ? code : undefined,
  });
}