import { describe, it, expect } from "vitest";
import { canonicalSku, cleanProductName } from "./sku";

describe("canonicalSku", () => {
  it("coerces Excel float to integer string", () => {
    expect(canonicalSku(16223.0)).toBe("16223");
    expect(canonicalSku("16223.0")).toBe("16223");
    expect(canonicalSku("16223.00")).toBe("16223");
  });
  it("keeps plain integer codes", () => {
    expect(canonicalSku(16223)).toBe("16223");
    expect(canonicalSku("16223")).toBe("16223");
  });
  it("trims whitespace", () => {
    expect(canonicalSku("  16223 ")).toBe("16223");
  });
  it("handles null/undefined/empty", () => {
    expect(canonicalSku(null)).toBe("");
    expect(canonicalSku(undefined)).toBe("");
    expect(canonicalSku("")).toBe("");
  });
  it("preserves non-numeric codes (Rebel/CZ may differ)", () => {
    expect(canonicalSku("REB-001")).toBe("REB-001");
  });
});

describe("cleanProductName", () => {
  it("strips the #_# marker prefix", () => {
    expect(cleanProductName("#_# Mango Mithai Box")).toBe("Mango Mithai Box");
    expect(cleanProductName("#_#Coffee Rasgulla")).toBe("Coffee Rasgulla");
  });
  it("leaves clean names untouched", () => {
    expect(cleanProductName("Gulab Jamun")).toBe("Gulab Jamun");
  });
});
