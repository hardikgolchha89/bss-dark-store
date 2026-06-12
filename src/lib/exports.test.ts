import { describe, it, expect } from "vitest";
import {
  buildPORows,
  buildErpRows,
  buildConsolidatedRows,
  PO_HEADER,
  ERP_HEADER,
} from "./exports";

describe("buildPORows", () => {
  it("emits the exact partner column order", () => {
    expect(buildPORows([])[0]).toEqual([...PO_HEADER]);
  });
  it("uses the partner sku, pcs unit, and 1.0 cost placeholder", () => {
    const rows = buildPORows([{ skuCode: "16223", name: "Mango Mithai", unit: "pcs", qty: 5 }]);
    expect(rows[1]).toEqual(["16223", "Mango Mithai", "", "pcs", 5, 1]);
  });
  it("drops zero/negative quantity lines", () => {
    const rows = buildPORows([
      { skuCode: "1", name: "a", unit: "pcs", qty: 0 },
      { skuCode: "2", name: "b", unit: "pcs", qty: 3 },
    ]);
    expect(rows).toHaveLength(2); // header + one line
    expect(rows[1][0]).toBe("2");
  });
});

describe("buildErpRows", () => {
  it("emits the stock-entry header literally", () => {
    expect(buildErpRows([], "SRC")[0]).toEqual([...ERP_HEADER]);
  });
  it("maps source/target warehouse, item code, qty and Nos UOM", () => {
    const rows = buildErpRows(
      [{ tWarehouse: "HK- BKC - HIHPL", itemCode: "ITEM-1", qty: 7 }],
      "Andheri Dark Store Ops  - HIHPL",
    );
    expect(rows[1]).toEqual([
      "",
      "",
      "Andheri Dark Store Ops  - HIHPL",
      "HK- BKC - HIHPL",
      "ITEM-1",
      7,
      "Nos",
      "Nos",
      1,
    ]);
  });
});

describe("buildConsolidatedRows", () => {
  it("totals per item and skips zeros", () => {
    const rows = buildConsolidatedRows([
      { skuCode: "1", name: "a", category: "Fresh", total: 12 },
      { skuCode: "2", name: "b", category: "Mithai", total: 0 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(["1", "a", "Fresh", 12]);
  });
});
