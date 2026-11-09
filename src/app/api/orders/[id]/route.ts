import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { canReadOrder } from "@/lib/access";
import { buildSummaryWithAi, type Lang } from "@/lib/summary";
import { db, withRetry } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await canReadOrder(s, id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lang = z.enum(["en", "te", "hi"]).catch("en").parse(new URL(req.url).searchParams.get("lang")) as Lang;
  const ready = order.status !== "PROCESSING";

  await withRetry(() =>
    db.accessLog.create({ data: { actor: s.userId, action: "REPORT_VIEW", orderId: order.id } })
  );

  if (!ready) {
    return NextResponse.json({ order: { orderCode: order.orderCode, status: order.status }, results: [], summary: null });
  }

  const summary = await buildSummaryWithAi(
    order.results.map((r) => ({ parameter: r.parameter, value: r.value, unit: r.unit, flag: r.flag })),
    lang
  );

  return NextResponse.json({
    order: { orderCode: order.orderCode, status: order.status, signedAt: order.signedAt, doctor: order.doctor?.name ?? null },
    results: order.results.map((r) => ({
      parameter: r.parameter, value: r.value, unit: r.unit, refLow: r.refLow, refHigh: r.refHigh, flag: r.flag,
    })),
    summary: summary.kind === "critical" ? { kind: "critical" } : { kind: "ok", text: summary.text, source: summary.source },
  });
}
