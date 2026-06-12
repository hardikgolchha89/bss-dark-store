import { describe, it, expect } from "vitest";
import { resolvePar, suggestedQty, isAnomalousLive } from "./requirement";

describe("resolvePar", () => {
  it("override wins over template", () => {
    expect(resolvePar(5, 10)).toBe(5);
  });
  it("falls back to template when no override", () => {
    expect(resolvePar(null, 10)).toBe(10);
    expect(resolvePar(undefined, 10)).toBe(10);
  });
  it("defaults to 0 when neither set", () => {
    expect(resolvePar(null, null)).toBe(0);
  });
  it("treats override of 0 as a real value, not missing", () => {
    expect(resolvePar(0, 10)).toBe(0);
  });
});

describe("suggestedQty", () => {
  it("orders the gap when live below par", () => {
    expect(suggestedQty(10, 4)).toBe(6);
  });
  it("orders nothing when live at or above par", () => {
    expect(suggestedQty(10, 10)).toBe(0);
    expect(suggestedQty(10, 15)).toBe(0);
  });
  it("orders full par when live is zero", () => {
    expect(suggestedQty(10, 0)).toBe(10);
  });
  it("CLAMPS negative live to 0 (no over-ordering) — the key bug fix", () => {
    // par 10, live -2 must order 10, NOT 12
    expect(suggestedQty(10, -2)).toBe(10);
    expect(suggestedQty(8, -5)).toBe(8);
  });
  it("orders nothing when par is 0", () => {
    expect(suggestedQty(0, 0)).toBe(0);
    expect(suggestedQty(0, -3)).toBe(0);
  });
});

describe("isAnomalousLive", () => {
  it("flags negative live", () => {
    expect(isAnomalousLive(-1)).toBe(true);
    expect(isAnomalousLive(0)).toBe(false);
    expect(isAnomalousLive(5)).toBe(false);
  });
});
