import { parse } from "csv-parse/sync";
import { z } from "zod";
import { db, withRetry } from "./db";
import { flagFor } from "./rules";
import { createReportLink } from "./links";

const optNum = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().optional()
);

const Row = z.object({
  order_code: z.string().min(3),
  patient_name: z.string().min(1),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  doctor: z.string().optional().default(""),
  parameter: z.string().min(1),
  unit: z.string().default(""),
  value: z.coerce.number(),
  ref_low: z.coerce.number(),
  ref_high: z.coerce.number(),
  critical_low: optNum,
  critical_high: optNum,
  status: z.enum(["PROCESSING", "READY"]),
});

export type ImportResult = {
  imported: number;
  links: number;
  errors: { line: number; message: string }[];
};

export async function importCsv(text: string): Promise<ImportResult> {
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const result: ImportResult = { imported: 0, links: 0, errors: [] };

  for (let i = 0; i < records.length; i++) {
    const parsed = Row.safeParse(records[i]);
    if (!parsed.success) {
      result.errors.push({
        line: i + 2,
        message: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
      });
      continue;
    }
    const r = parsed.data;
    try {
      const user = await withRetry(() =>
        db.user.upsert({
          where: { mobile: r.mobile },
          update: {},
          create: { mobile: r.mobile, name: r.patient_name, role: "PATIENT", consentAt: new Date() },
        })
      );
      let patient = await db.patient.findFirst({ where: { ownerId: user.id, name: r.patient_name } });
      if (!patient) patient = await db.patient.create({ data: { name: r.patient_name, ownerId: user.id } });

      const doctor = r.doctor
        ? (await db.doctor.findFirst({ where: { name: r.doctor } })) ??
          (await db.doctor.create({ data: { name: r.doctor } }))
        : null;

      const flag = flagFor(r.value, r.ref_low, r.ref_high, r.critical_low, r.critical_high);
      const critical = flag === "CRITICAL";
      const status = r.status === "PROCESSING" ? "PROCESSING" : critical ? "READY_CRITICAL" : "READY";

      const existing = await db.order.findUnique({ where: { orderCode: r.order_code } });
      const wasSigned = !!existing?.signedAt;

      const order = existing
        ? await db.order.update({
            where: { id: existing.id },
            data: { status, signedAt: r.status === "READY" ? existing.signedAt ?? new Date() : null },
          })
        : await db.order.create({
            data: {
              orderCode: r.order_code,
              patientId: patient.id,
              doctorId: doctor?.id,
              status,
              signedAt: r.status === "READY" ? new Date() : null,
            },
          });

      await db.result.deleteMany({ where: { orderId: order.id, parameter: r.parameter } });
      await db.result.create({
        data: {
          orderId: order.id,
          parameter: r.parameter,
          unit: r.unit,
          value: r.value,
          refLow: r.ref_low,
          refHigh: r.ref_high,
          criticalLow: r.critical_low ?? null,
          criticalHigh: r.critical_high ?? null,
          flag,
        },
      });
      result.imported++;

      if (critical) {
        const open = await db.callbackTask.findFirst({ where: { orderId: order.id, doneAt: null } });
        if (!open)
          await db.callbackTask.create({
            data: { orderId: order.id, reason: `Critical value: ${r.parameter} ${r.value} ${r.unit}` },
          });
      }

      // Auto link only on first sign-off (no duplicate sends)
      if (r.status === "READY" && !wasSigned) {
        const token = await createReportLink(order.id, "SMS");
        result.links++;
        if (process.env.NODE_ENV !== "production") {
          console.log(`[MOCK SMS] to ${r.mobile}: Your report is ready: /r/${token}`);
        }
      }
    } catch (e) {
      result.errors.push({ line: i + 2, message: (e as Error).message });
    }
  }
  return result;
}