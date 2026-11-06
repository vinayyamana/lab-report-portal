import { NextResponse } from "next/server";
import { z } from "zod";
import { lookupLink } from "@/lib/links";
import { verifyOtp } from "@/lib/otp";
import { createSession } from "@/lib/session";
import { db, withRetry } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const r = await lookupLink(token);
  if (r.status !== "ok") return NextResponse.json({ error: r.status }, { status: 410 });

  const res = await verifyOtp(r.mobile, body.data.code);
  if (res !== "ok") return NextResponse.json({ error: res }, { status: 401 });

  const user = await withRetry(() => db.user.findUnique({ where: { mobile: r.mobile } }));
  if (!user) return NextResponse.json({ error: "invalid" }, { status: 404 });

  await createSession({ userId: user.id, role: "PATIENT" });
  await withRetry(() =>
    db.accessLog.create({ data: { actor: user.id, action: "LINK_OPEN", orderId: r.orderId } })
  );
  return NextResponse.json({ ok: true, orderId: r.orderId });
}