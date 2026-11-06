import { createHash, randomBytes } from "crypto";
import { db, withRetry } from "./db";

const LINK_TTL_MS = 72 * 60 * 60 * 1000;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createReportLink(orderId: string, channel = "SMS") {
  const token = randomBytes(32).toString("base64url");
  await withRetry(() =>
    db.reportLink.create({
      data: {
        tokenHash: hash(token),
        orderId,
        channel,
        expiresAt: new Date(Date.now() + LINK_TTL_MS),
      },
    })
  );
  return token;
}

export type LinkLookup =
  | { status: "ok"; orderId: string; mobile: string }
  | { status: "expired" | "invalid" };

export async function lookupLink(token: string): Promise<LinkLookup> {
  const link = await withRetry(() =>
    db.reportLink.findUnique({
      where: { tokenHash: hash(token) },
      include: { order: { include: { patient: { include: { owner: true } } } } },
    })
  );
  if (!link) return { status: "invalid" };
  if (link.expiresAt < new Date()) return { status: "expired" };
  return { status: "ok", orderId: link.orderId, mobile: link.order.patient.owner.mobile };
}

export const maskMobile = (m: string) => `${m.slice(0, 2)}******${m.slice(-2)}`;