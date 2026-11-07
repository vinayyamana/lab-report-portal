import { describe, it, expect } from "vitest";
import { flagFor } from "@/lib/rules";

describe("flagFor", () => {
  it("normal inside range", () => expect(flagFor(13, 12, 15.5)).toBe("NORMAL"));
  it("low below range", () => expect(flagFor(10.2, 12, 15.5, 7, 20)).toBe("LOW"));
  it("high above range", () => expect(flagFor(142, 0, 100)).toBe("HIGH"));
  it("boundaries are normal", () => {
    expect(flagFor(12, 12, 15.5)).toBe("NORMAL");
    expect(flagFor(15.5, 12, 15.5)).toBe("NORMAL");
  });
  it("critical high", () => expect(flagFor(6.8, 3.5, 5.1, 2.5, 6.5)).toBe("CRITICAL"));
  it("critical low", () => expect(flagFor(2, 3.5, 5.1, 2.5, 6.5)).toBe("CRITICAL"));
  it("no critical limits means never critical", () => expect(flagFor(999, 0, 100)).toBe("HIGH"));
});
