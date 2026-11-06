import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db, withRetry } from "@/lib/db";

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "PATIENT" || !s.patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await withRetry(() =>
    db.order.findMany({
      where: { patientId: s.patientId, patient: { ownerId: s.userId } },
      orderBy: { orderCode: "desc" },
      select: { id: true, orderCode: true, status: true, signedAt: true, doctor: { select: { name: true } } },
    })
  );
  return NextResponse.json({ orders });
}
