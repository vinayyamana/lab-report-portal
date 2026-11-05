import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, createSession } from "@/lib/session";
import { db, withRetry } from "@/lib/db";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "PATIENT") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = z.object({ patientId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Access control: patient must belong to THIS user
  const p = await withRetry(() =>
    db.patient.findFirst({ where: { id: parsed.data.patientId, ownerId: s.userId } })
  );
  if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await createSession({ ...s, patientId: p.id });
  return NextResponse.json({ ok: true });
}