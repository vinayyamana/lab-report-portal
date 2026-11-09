import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canReadOrder } from "@/lib/access";
import { buildReportPdf } from "@/lib/pdf";
import { db, withRetry } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await canReadOrder(s, id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status === "PROCESSING") return NextResponse.json({ error: "Report not ready" }, { status: 409 });

  const bytes = await buildReportPdf({
    orderCode: order.orderCode,
    patientName: order.patient.name,
    doctorName: order.doctor?.name ?? null,
    signedAt: order.signedAt,
    results: order.results.map((r) => ({
      parameter: r.parameter, value: r.value, unit: r.unit, refLow: r.refLow, refHigh: r.refHigh, flag: r.flag,
    })),
  });

  await withRetry(() =>
    db.accessLog.create({ data: { actor: s.userId, action: "REPORT_PDF", orderId: order.id } })
  );

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.orderCode}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}