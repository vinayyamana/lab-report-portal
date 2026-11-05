import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtp, isValidMobile } from "@/lib/otp";
import { createSession } from "@/lib/session";
import { db, withRetry } from "@/lib/db";

const schema = z.object({
  mobile: z.string().refine(isValidMobile),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { mobile, code } = parsed.data;
  const result = await verifyOtp(mobile, code);
  if (result !== "ok") {
    const msg = { invalid: "Wrong code", expired: "Code expired", locked: "Too many attempts. Request a new code." }[result];
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  const user = await withRetry(() =>
    db.user.findUnique({ where: { mobile }, include: { patients: true } })
  );
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Single patient: log straight in. Family: client must choose.
  if (user.role === "PATIENT" && user.patients.length > 1) {
    await createSession({ userId: user.id, role: user.role });
    return NextResponse.json({ ok: true, choose: user.patients.map((p) => ({ id: p.id, name: p.name })) });
  }
  await createSession({ userId: user.id, role: user.role, patientId: user.patients[0]?.id });
  return NextResponse.json({ ok: true, role: user.role });
}