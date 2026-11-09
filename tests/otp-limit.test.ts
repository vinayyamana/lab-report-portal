import { describe, it, expect, vi, beforeEach } from "vitest";

let createdAts: { mobile: string; createdAt: Date }[] = [];

vi.mock("../src/lib/db", () => ({
  withRetry: (fn: () => unknown) => fn(),
  db: {
    otpCode: {
      count: async ({ where }: { where: { mobile: string; createdAt: { gte: Date } } }) =>
        createdAts.filter((r) => r.mobile === where.mobile && r.createdAt >= where.createdAt.gte).length,
    },
  },
}));

import { otpRateLimited, OTP_MAX_REQUESTS, OTP_WINDOW_MS } from "../src/lib/otp-limit";

const NOW = Date.UTC(2026, 10, 9, 8, 0, 0);
const at = (msAgo: number) => new Date(NOW - msAgo);

beforeEach(() => { createdAts = []; });

describe("otpRateLimited", () => {
  it("allows the first requests", async () => {
    createdAts = [{ mobile: "9000000002", createdAt: at(1000) }];
    expect(await otpRateLimited("9000000002", NOW)).toBe(false);
  });
  it("blocks once the limit is reached in the window", async () => {
    createdAts = Array.from({ length: OTP_MAX_REQUESTS }, (_, i) => ({ mobile: "9000000002", createdAt: at(i * 1000) }));
    expect(await otpRateLimited("9000000002", NOW)).toBe(true);
  });
  it("does not count requests older than the window", async () => {
    createdAts = Array.from({ length: OTP_MAX_REQUESTS }, () => ({ mobile: "9000000002", createdAt: at(OTP_WINDOW_MS + 60000) }));
    expect(await otpRateLimited("9000000002", NOW)).toBe(false);
  });
  it("is per mobile", async () => {
    createdAts = Array.from({ length: OTP_MAX_REQUESTS }, () => ({ mobile: "9000000002", createdAt: at(1000) }));
    expect(await otpRateLimited("9000000003", NOW)).toBe(false);
  });
});