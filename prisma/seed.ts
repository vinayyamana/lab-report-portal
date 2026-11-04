import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

function flagFor(v: number, lo: number, hi: number, cl?: number, ch?: number) {
  if ((cl !== undefined && v <= cl) || (ch !== undefined && v >= ch)) return "CRITICAL";
  if (v < lo) return "LOW";
  if (v > hi) return "HIGH";
  return "NORMAL";
}

async function main() {
  await db.accessLog.deleteMany();
  await db.callbackTask.deleteMany();
  await db.summary.deleteMany();
  await db.reportLink.deleteMany();
  await db.result.deleteMany();
  await db.order.deleteMany();
  await db.patient.deleteMany();
  await db.otpCode.deleteMany();
  await db.user.deleteMany();
  await db.doctor.deleteMany();

  const [ram, anitha, suresh] = await Promise.all([
    db.doctor.create({ data: { name: "Dr. S. Ramanaiah" } }),
    db.doctor.create({ data: { name: "Dr. P. Anitha" } }),
    db.doctor.create({ data: { name: "Dr. K. Suresh" } }),
  ]);

  await db.user.create({
    data: { mobile: "9000000001", name: "Front Desk Demo", role: "FRONT_DESK" },
  });

  // Family: one mobile, two patients
  const family = await db.user.create({
    data: { mobile: "9000000002", name: "Prasanna Family", role: "PATIENT", consentAt: new Date() },
  });
  const lakshmi = await db.patient.create({ data: { name: "Lakshmi Prasanna K", ownerId: family.id } });
  const venkata = await db.patient.create({ data: { name: "Venkata Rao M", ownerId: family.id } });

  const farzanaUser = await db.user.create({
    data: { mobile: "9000000003", name: "Farzana Begum", role: "PATIENT", consentAt: new Date() },
  });
  const farzana = await db.patient.create({ data: { name: "Farzana Begum", ownerId: farzanaUser.id } });

  const make = async (
    code: string, patientId: string, doctorId: string,
    status: "READY" | "PROCESSING" | "READY_CRITICAL",
    p: string, unit: string, v: number, lo: number, hi: number, cl?: number, ch?: number
  ) => {
    const order = await db.order.create({
      data: {
        orderCode: code, patientId, doctorId, status,
        signedAt: status === "PROCESSING" ? null : new Date(),
      },
    });
    await db.result.create({
      data: {
        orderId: order.id, parameter: p, unit, value: v, refLow: lo, refHigh: hi,
        criticalLow: cl, criticalHigh: ch, flag: flagFor(v, lo, hi, cl, ch),
      },
    });
    if (status === "READY_CRITICAL") {
      await db.callbackTask.create({
        data: { orderId: order.id, reason: "Critical value: Potassium 6.8 mmol/L" },
      });
    }
  };

  await make("ORD-71204", lakshmi.id, ram.id, "READY", "Haemoglobin", "g/dL", 10.2, 12.0, 15.5, 7, 20);
  await make("ORD-71219", venkata.id, anitha.id, "PROCESSING", "LDL cholesterol", "mg/dL", 142, 0, 100);
  await make("ORD-71233", farzana.id, suresh.id, "READY_CRITICAL", "Potassium", "mmol/L", 6.8, 3.5, 5.1, 2.5, 6.5);
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1); });