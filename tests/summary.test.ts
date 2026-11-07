import { describe, it, expect } from "vitest";
import { buildSummary } from "@/lib/summary";

const hb = { parameter: "Haemoglobin", value: 10.2, unit: "g/dL", flag: "LOW" as const };

describe("buildSummary", () => {
  it("gives no summary for critical values", () => {
    expect(buildSummary([{ ...hb, flag: "CRITICAL" }], "en")).toEqual({ kind: "critical" });
  });
  it("critical anywhere blocks the whole summary", () => {
    expect(buildSummary([hb, { ...hb, parameter: "K", flag: "CRITICAL" }], "te").kind).toBe("critical");
  });
  it("says all normal when nothing is abnormal", () => {
    const r = buildSummary([{ ...hb, flag: "NORMAL" }], "en");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.text).toContain("normal range");
  });
  it("mentions the abnormal parameter and value", () => {
    const r = buildSummary([hb], "en");
    if (r.kind === "ok") expect(r.text).toContain("Haemoglobin (10.2 g/dL)");
  });
  it("works in Telugu and Hindi", () => {
    for (const l of ["te", "hi"] as const) expect(buildSummary([hb], l).kind).toBe("ok");
  });
});
