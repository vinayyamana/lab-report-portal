import { describe, it, expect, vi, beforeEach } from "vitest";

type Rec = {
  id: number;
  mobile: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
  createdAt: Date;
};

let rows: Rec[] = [];
let seq = 0;

vi.mock("../src/lib/db", () => ({
  withRetry: (fn: () => any) => fn(),
  db: {
    otpCode: {
      updateMany: async ({ where, data }: any) => {
        rows
          .filter((r) => r.mobile === where.mobile && r.usedAt === null)
          .forEach((r) => Object.assign(r, data));
      },
      create: async ({ data }: any) => {
        rows.push({
          id: ++seq,
          attempts: 0,
          usedAt: null,
          createdAt: new Date(),
          ...data,
        });
      },
      findFirst: async ({ where }: any) =>
        [...rows]
          .filter((r) => r.mobile === where.mobile && r.usedAt === null)
          .sort((a, b) => b.id - a.id)[0] ?? null,
      update: async ({ where, data }: any) => {
        const r = rows.find((x) => x.id === where.id)!;
        if (data.attempts?.increment) r.attempts += data.attempts.increment;
        if (data.usedAt) r.usedAt = data.usedAt;
      },
    },
  },
}));

import { isValidMobile, issueOtp, verifyOtp } from "../src/lib/otp";

const M = "9876543210";

describe("mobile validation", () => {
  it("accepts valid Indian mobiles", () => {
    expect(isValidMobile("9876543210")).toBe(true);
    expect(isValidMobile("6000000000")).toBe(true);
  });
  it("rejects bad formats", () => {
    expect(isValidMobile("1234567890")).toBe(false);
    expect(isValidMobile("98765")).toBe(false);
    expect(isValidMobile("98765432100")).toBe(false);
    expect(isValidMobile("98765abcde")).toBe(false);
  });
});

describe("otp", () => {
  beforeEach(() => {
    rows = [];
    seq = 0;
  });

  it("issues a 6 digit code and stores only a hash", async () => {
    const code = await issueOtp(M);
    expect(code).toMatch(/^\d{6}$/);
    expect(rows[0].codeHash).not.toBe(code);
  });

  it("accepts the right code once", async () => {
    const code = await issueOtp(M);
    expect(await verifyOtp(M, code)).toBe("ok");
    expect(await verifyOtp(M, code)).toBe("invalid"); // already used
  });

  it("rejects a wrong code", async () => {
    await issueOtp(M);
    expect(await verifyOtp(M, "000000")).toBe("invalid");
  });

  it("locks after 5 wrong attempts, even for the right code", async () => {
    const code = await issueOtp(M);
    for (let i = 0; i < 5; i++) {
      expect(await verifyOtp(M, "000000")).toBe("invalid");
    }
    expect(await verifyOtp(M, code)).toBe("locked");
  });

  it("rejects an expired code", async () => {
    const code = await issueOtp(M);
    rows[0].expiresAt = new Date(Date.now() - 1000);
    expect(await verifyOtp(M, code)).toBe("expired");
  });

  it("a new OTP invalidates the older one", async () => {
    const first = await issueOtp(M);
    const second = await issueOtp(M);
    expect(await verifyOtp(M, first)).toBe("invalid");
    expect(await verifyOtp(M, second)).toBe("ok");
  });

  it("returns invalid when no OTP was issued", async () => {
    expect(await verifyOtp(M, "123456")).toBe("invalid");
  });
});