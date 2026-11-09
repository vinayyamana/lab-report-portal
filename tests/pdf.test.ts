import { describe, it, expect } from "vitest";
import { buildReportPdf, safe, type PdfReport } from "@/lib/pdf";

const report: PdfReport = {
  orderCode: "ORD-71204",
  patientName: "Lakshmi Prasanna K",
  doctorName: "Dr. S. Ramanaiah",
  signedAt: new Date("2026-11-04T05:00:00Z"),
  results: [
    { parameter: "Haemoglobin", value: 10.2, unit: "g/dL", refLow: 12, refHigh: 15.5, flag: "LOW" },
    { parameter: "Potassium", value: 4.2, unit: "mmol/L", refLow: 3.5, refHigh: 5.1, flag: "NORMAL" },
  ],
};

describe("buildReportPdf", () => {
  it("creates a valid PDF", async () => {
    const bytes = await buildReportPdf(report);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });
  it("does not crash on Telugu or other non-Latin text", async () => {
    const bytes = await buildReportPdf({ ...report, patientName: "లక్ష్మి ప్రసన్న", doctorName: null, signedAt: null });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
  it("handles a report with no results", async () => {
    const bytes = await buildReportPdf({ ...report, results: [] });
    expect(bytes.length).toBeGreaterThan(500);
  });
});

describe("safe", () => {
  it("keeps Latin text and replaces unsupported characters", () => {
    expect(safe("Dr. S. Ramanaiah")).toBe("Dr. S. Ramanaiah");
    expect(safe("అ")).toBe("?");
  });
});