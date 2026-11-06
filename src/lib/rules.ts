export type Flag = "NORMAL" | "LOW" | "HIGH" | "CRITICAL";

export function flagFor(v: number, lo: number, hi: number, cl?: number | null, ch?: number | null): Flag {
  if ((cl != null && v <= cl) || (ch != null && v >= ch)) return "CRITICAL";
  if (v < lo) return "LOW";
  if (v > hi) return "HIGH";
  return "NORMAL";
}