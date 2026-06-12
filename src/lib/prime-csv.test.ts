import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parsePrimeBuffer } from "./prime-csv";

function makeBuffer(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const HEADER = [
  "Id",
  "Location",
  "Product",
  "Category",
  "Sku",
  "Unit",
  "Unit Count",
  "Unit Weighted Cost",
  "Unit Par Level",
  "Health",
];

describe("parsePrimeBuffer", () => {
  it("reads location, sku (float-coerced), name, and live count", () => {
    const buf = makeBuffer([
      HEADER,
      [1, "Bombay Sweet Shop Inventory - BKC", "#_# Mango Mithai", "x", 16223.0, "pcs", 5, 1, 0, "healthy"],
    ]);
    const res = parsePrimeBuffer(buf);
    expect(res.locationRaw).toBe("Bombay Sweet Shop Inventory - BKC");
    expect(res.rows).toEqual([{ skuCode: "16223", name: "Mango Mithai", liveQty: 5 }]);
  });

  it("SUMS duplicate sku rows within a file", () => {
    const buf = makeBuffer([
      HEADER,
      [1, "L", "#_# A", "x", 100, "pcs", 3, 1, 0, "ok"],
      [2, "L", "#_# A", "x", 100, "pcs", 4, 1, 0, "ok"],
    ]);
    const res = parsePrimeBuffer(buf);
    expect(res.rows).toEqual([{ skuCode: "100", name: "A", liveQty: 7 }]);
  });

  it("keeps negative live as-is (clamping happens in requirement math)", () => {
    const buf = makeBuffer([HEADER, [1, "L", "#_# A", "x", 100, "pcs", -2, 1, 0, "ok"]]);
    expect(parsePrimeBuffer(buf).rows[0].liveQty).toBe(-2);
  });

  it("errors clearly when required columns are missing", () => {
    const buf = makeBuffer([["foo", "bar"], [1, 2]]);
    const res = parsePrimeBuffer(buf);
    expect(res.rows).toHaveLength(0);
    expect(res.errors[0]).toMatch(/header row/i);
  });
});
