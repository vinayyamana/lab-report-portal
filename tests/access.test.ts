import { describe, it, expect, vi } from "vitest";

const order = {
  id: "O1",
  patientId: "P1",
  patient: { ownerId: "U1" },
  results: [],
  doctor: null,
};

vi.mock("../src/lib/db", () => ({
  withRetry: (fn: () => any) => fn(),
  db: {
    order: {
      findUnique: async ({ where }: any) =>
        where.id === "O1" ? order : null,
    },
  },
}));

import { canReadOrder } from "../src/lib/access";

const s = (o: any) => ({ userId: "U1", role: "PATIENT", ...o }) as any;

describe("canReadOrder", () => {
  it("returns null for a missing order", async () => {
    expect(await canReadOrder(s({}), "NOPE")).toBeNull();
  });

  it("front desk can read any order", async () => {
    expect(await canReadOrder(s({ role: "FRONT_DESK", userId: "X" }), "O1")).toBe(order);
  });

  it("patient can read an order of a patient they own", async () => {
    expect(await canReadOrder(s({}), "O1")).toBe(order);
  });

  it("another patient cannot read it", async () => {
    expect(await canReadOrder(s({ userId: "U2" }), "O1")).toBeNull();
  });

  it("family: selected member must match the order's patient", async () => {
    expect(await canReadOrder(s({ patientId: "P1" }), "O1")).toBe(order);
    expect(await canReadOrder(s({ patientId: "P2" }), "O1")).toBeNull();
  });

  it("unknown role is denied", async () => {
    expect(await canReadOrder(s({ role: "OTHER" }), "O1")).toBeNull();
  });
});