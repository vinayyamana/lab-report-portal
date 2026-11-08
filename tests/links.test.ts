import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, any>();

vi.mock("../src/lib/db", () => ({
  withRetry: (fn: () => any) => fn(),
  db: {
    reportLink: {
      create: async ({ data }: any) => {
        store.set(data.tokenHash, {
          ...data,
          order: { patient: { owner: { mobile: "9876543210" } } },
        });
      },
      findUnique: async ({ where }: any) => store.get(where.tokenHash) ?? null,
    },
  },
}));

import { createReportLink, lookupLink, maskMobile } from "../src/lib/links";

describe("report links", () => {
  beforeEach(() => store.clear());

  it("returns a url-safe token and stores only its hash", async () => {
    const token = await createReportLink("ORD-1");
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(store.has(token)).toBe(false);
    expect([...store.values()][0].tokenHash).not.toBe(token);
  });

  it("generates a different token each time", async () => {
    const a = await createReportLink("ORD-1");
    const b = await createReportLink("ORD-1");
    expect(a).not.toBe(b);
  });

  it("sets expiry to 72 hours", async () => {
    const before = Date.now();
    await createReportLink("ORD-1");
    const exp = [...store.values()][0].expiresAt.getTime();
    const h72 = 72 * 3600 * 1000;
    expect(exp - before).toBeGreaterThanOrEqual(h72 - 1000);
    expect(exp - before).toBeLessThanOrEqual(h72 + 5000);
  });

  it("accepts a fresh token", async () => {
    const token = await createReportLink("ORD-1");
    const r = await lookupLink(token);
    expect(r).toMatchObject({ status: "ok", orderId: "ORD-1" });
  });

  it("rejects an unknown token as invalid", async () => {
    expect((await lookupLink("nope")).status).toBe("invalid");
  });

  it("rejects an expired token", async () => {
    const token = await createReportLink("ORD-1");
    [...store.values()][0].expiresAt = new Date(Date.now() - 1000);
    expect((await lookupLink(token)).status).toBe("expired");
  });

  it("masks mobile numbers", () => {
    expect(maskMobile("9876543210")).toBe("98******10");
  });
});