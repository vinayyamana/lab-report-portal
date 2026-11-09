import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PdfResult = { parameter: string; value: number; unit: string; refLow: number; refHigh: number; flag: string };
export type PdfReport = {
  orderCode: string;
  patientName: string;
  doctorName: string | null;
  signedAt: Date | null;
  results: PdfResult[];
};

// Standard PDF fonts cover Latin only. Replace anything else so pdf-lib does not throw.
export const safe = (s: string) => s.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");

const FLAG_LABEL: Record<string, string> = { NORMAL: "Normal", LOW: "Low", HIGH: "High", CRITICAL: "Critical" };

export async function buildReportPdf(r: PdfReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  const ink = rgb(0.1, 0.1, 0.1);
  const grey = rgb(0.4, 0.4, 0.4);
  let y = 790;

  const text = (t: string, x: number, size = 11, f = font, color = ink) =>
    page.drawText(safe(t), { x, y, size, font: f, color });

  text("Lab Report", 50, 20, bold);
  y -= 26;
  text(`Order: ${r.orderCode}`, 50);
  y -= 16;
  text(`Patient: ${r.patientName}`, 50);
  y -= 16;
  text(`Referring doctor: ${r.doctorName ?? "-"}`, 50);
  y -= 16;
  const signed = r.signedAt
    ? r.signedAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })
    : "-";
  text(`Signed on: ${signed}`, 50);
  y -= 30;

  const cols = [50, 230, 300, 380, 480];
  ["Test", "Result", "Unit", "Normal range", "Status"].forEach((h, i) => text(h, cols[i], 10, bold, grey));
  y -= 6;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.7, color: grey });
  y -= 16;

  for (const row of r.results) {
    const abnormal = row.flag !== "NORMAL";
    text(row.parameter, cols[0]);
    text(String(row.value), cols[1], 11, abnormal ? bold : font);
    text(row.unit, cols[2]);
    text(`${row.refLow} - ${row.refHigh}`, cols[3]);
    text(FLAG_LABEL[row.flag] ?? row.flag, cols[4], 11, abnormal ? bold : font);
    y -= 18;
  }

  y -= 20;
  page.drawText("Generated from the signed lab report. Please see your doctor for advice.", { x: 50, y, size: 9, font, color: grey });
  return doc.save();
}