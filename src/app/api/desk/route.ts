import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db, withRetry } from "@/lib/db";
import { createReportLink } from "@/lib/links";

async function desk() {
  const s = await getSession();
  return s && s.role === "FRONT_DESK" ? s : null;
}

export async function GET(req: Request) {
  const s = await desk();
  if (!s) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "orders";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 50);

  if (view === "orders") {
    const orders = await withRetry(() =>
      db.order.findMany({
        where: q
          ? {
              OR: [
                { orderCode: { contains: q, mode: "insensitive" } },
                { patient: { name: { contains: q, mode: "insensitive" } } },
                { patient: { owner: { mobile: { contains: q } } } },
              ],
            }
          : {},
        orderBy: { orderCode: "desc" },
        take: 30,
        include: {
          patient: { include: { owner: true } },
          links: { orderBy: { sentAt: "desc" }, take: 1 },
        },
      })
    );
    const now = new Date();
    return NextResponse.json({
      orders: orders.map((o) => {
        const l = o.links[0];
        const delivery = !l ? "Not sent" : l.openedAt ? "Opened" : l.expiresAt < now ? "Expired" : "Sent";
        return {
          id: o.id,
          orderCode: o.orderCode,
          patient: o.patient.name,
          mobile: o.patient.owner.mobile,
          status: o.status,
          delivery,
          sentAt: l?.sentAt ?? null,
        };
      }),
    });
  }

  if (view === "tasks") {
    const tasks = await withRetry(() =>
      db.callbackTask.findMany({
        where: { doneAt: null },
        orderBy: { createdAt: "asc" },
        include: { order: { include: { patient: { include: { owner: true } } } } },
      })
    );
    return NextResponse.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        reason: t.reason,
        orderCode: t.order.orderCode,
        patient: t.order.patient.name,
        mobile: t.order.patient.owner.mobile,
        createdAt: t.createdAt,
      })),
    });
  }

  if (view === "log") {
    const log = await withRetry(() => db.accessLog.findMany({ orderBy: { at: "desc" }, take: 50 }));
    return NextResponse.json({ log });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resend"), orderId: z.string().min(1) }),
  z.object({ action: z.literal("done"), id: z.string().min(1) }),
]);

export async function POST(req: Request) {
  const s = await desk();
  if (!s) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const b = parsed.data;

  if (b.action === "done") {
    await withRetry(() => db.callbackTask.update({ where: { id: b.id }, data: { doneAt: new Date() } }));
    await db.accessLog.create({ data: { actor: s.userId, action: "CALLBACK_DONE" } });
    return NextResponse.json({ ok: true });
  }

  const order = await withRetry(() =>
    db.order.findUnique({ where: { id: b.orderId }, include: { patient: { include: { owner: true } } } })
  );
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status === "PROCESSING") return NextResponse.json({ error: "Report not signed yet" }, { status: 409 });

  // Old links stop working: only the newest link is valid
  await db.reportLink.updateMany({
    where: { orderId: order.id, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });
  const token = await createReportLink(order.id, "SMS");
  if (process.env.NODE_ENV !== "production") {
    console.log(`[MOCK SMS] to ${order.patient.owner.mobile}: Your report is ready: /r/${token}`);
  }
  await db.accessLog.create({ data: { actor: s.userId, action: "LINK_RESEND", orderId: order.id } });
  return NextResponse.json({ ok: true });
}
