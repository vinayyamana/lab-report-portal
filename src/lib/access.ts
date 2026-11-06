import { db, withRetry } from "./db";
import type { Session } from "./session";

// A patient may only read orders of patients they own.
// Front desk may read any (but never sees summary-less critical bypass; they just see status).
export async function canReadOrder(s: Session, orderId: string) {
  const order = await withRetry(() =>
    db.order.findUnique({
      where: { id: orderId },
      include: { patient: true, results: true, doctor: true },
    })
  );
  if (!order) return null;
  if (s.role === "FRONT_DESK") return order;
  if (s.role === "PATIENT" && order.patient.ownerId === s.userId) {
    // family: if a patient is selected, restrict to that member
    if (s.patientId && order.patientId !== s.patientId) return null;
    return order;
  }
  return null;
}