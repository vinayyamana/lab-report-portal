import { describe, it, expect, vi } from "vitest";
import { aiExplain, validateAiText, type AiItem } from "@/lib/ai-summary";
import { buildSummaryWithAi } from "@/lib/summary";

const hb: AiItem = { parameter: "Haemoglobin", value: 10.2, unit: "g/dL", flag: "LOW" };

const okFetch = (text: string) =>
  vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 })) as unknown as typeof fetch;

describe("validateAiText", () => {
  it("accepts text that names the parameter and uses only given numbers", () => {
    expect(validateAiText("Your Haemoglobin is 10.2, which is low. See your doctor.", [hb])).toBe(true);
  });
  it("rejects invented numbers", () => {
    expect(validateAiText("Haemoglobin 10.2 is low, take 500 mg daily.", [hb])).toBe(false);
  });
  it("rejects text that skips a flagged parameter", () => {
    expect(validateAiText("Your blood is a little low.", [hb])).toBe(false);
  });
  it("rejects empty or very long text", () => {
    expect(validateAiText("", [hb])).toBe(false);
    expect(validateAiText("Haemoglobin " + "x".repeat(800), [hb])).toBe(false);
  });
});

describe("aiExplain", () => {
  it("returns null without an API key (no network call)", async () => {
    const f = vi.fn() as unknown as typeof fetch;
    expect(await aiExplain([hb], "en", { apiKey: "", fetchImpl: f })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("returns null on HTTP error", async () => {
    const f = vi.fn(async () => new Response("x", { status: 500 })) as unknown as typeof fetch;
    expect(await aiExplain([hb], "en", { apiKey: "k", fetchImpl: f })).toBeNull();
  });
  it("returns null when the network throws", async () => {
    const f = vi.fn(async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect(await aiExplain([hb], "en", { apiKey: "k", fetchImpl: f })).toBeNull();
  });
  it("returns null when the AI output fails validation", async () => {
    const f = okFetch("Haemoglobin is low, take 500 mg iron.");
    expect(await aiExplain([hb], "en", { apiKey: "k", fetchImpl: f })).toBeNull();
  });
  it("returns the text when valid", async () => {
    const f = okFetch("Your Haemoglobin is 10.2, a little low.");
    expect(await aiExplain([hb], "en", { apiKey: "k", fetchImpl: f })).toContain("Haemoglobin");
  });
});

describe("buildSummaryWithAi", () => {
  it("never calls AI for critical values", async () => {
    const explain = vi.fn();
    const r = await buildSummaryWithAi([{ ...hb, flag: "CRITICAL" }], "en", explain);
    expect(r).toEqual({ kind: "critical" });
    expect(explain).not.toHaveBeenCalled();
  });
  it("never calls AI when everything is normal", async () => {
    const explain = vi.fn();
    const r = await buildSummaryWithAi([{ ...hb, flag: "NORMAL" }], "en", explain);
    expect(explain).not.toHaveBeenCalled();
    expect(r.kind === "ok" && r.source).toBe("template");
  });
  it("uses AI text when available and marks source ai", async () => {
    const r = await buildSummaryWithAi([hb], "en", async () => "Your Haemoglobin is 10.2.");
    expect(r.kind === "ok" && r.source).toBe("ai");
  });
  it("falls back to the locked template when AI returns null", async () => {
    const r = await buildSummaryWithAi([hb], "en", async () => null);
    expect(r.kind === "ok" && r.source).toBe("template");
    if (r.kind === "ok") expect(r.text).toContain("Haemoglobin (10.2 g/dL)");
  });
});