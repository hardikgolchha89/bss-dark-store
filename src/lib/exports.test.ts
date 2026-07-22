import { describe, it, expect } from "vitest";
import {
  buildPORows,
  buildErpRows,
  buildConsolidatedRows,
  buildMatrixRows,
  buildItemsCsvRows,
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

describe("buildMatrixRows", () => {
  const stores = [
    { id: "s1", name: "Andheri" },
    { id: "s2", name: "Bandra" },
  ];
  it("pivots stores to columns with blank (not 0) empty cells and row/col totals", () => {
    const rows = buildMatrixRows(
      [
        { skuCode: "1", name: "Kaju", category: "Mithai", qtyByStore: { s1: 12 } },
        { skuCode: "2", name: "Motichoor", category: "Mithai", qtyByStore: { s2: 5 } },
      ],
      stores,
    );
    expect(rows[0]).toEqual(["SKU", "Name", "Category", "Andheri", "Bandra", "Total"]);
    expect(rows[1]).toEqual(["1", "Kaju", "Mithai", 12, "", 12]); // s2 blank, not 0
    expect(rows[2]).toEqual(["2", "Motichoor", "Mithai", "", 5, 5]);
    expect(rows[3]).toEqual(["", "Total", "", 12, 5, 17]); // per-store + grand totals
  });
  it("drops items sent nowhere", () => {
    const rows = buildMatrixRows(
      [{ skuCode: "1", name: "Ghost", category: "", qtyByStore: { s1: 0 } }],
      stores,
    );
    expect(rows).toHaveLength(2); // header + totals only, no data row
    expect(rows[1]).toEqual(["", "Total", "", "", "", 0]);
  });
});

describe("buildItemsCsvRows", () => {
  it("emits HK SKU · Name · ERPNext Code · Rebel SKU", () => {
    const rows = buildItemsCsvRows([
      { hkSku: "16223", name: "Kaju Katli", erpnextCode: "ITEM-1", rebelSku: "SLM-9" },
      { hkSku: "", name: "No codes", erpnextCode: "", rebelSku: "" },
    ]);
    expect(rows[0]).toEqual(["HK SKU", "Name", "ERPNext Code", "Rebel SKU"]);
    expect(rows[1]).toEqual(["16223", "Kaju Katli", "ITEM-1", "SLM-9"]);
    expect(rows[2]).toEqual(["", "No codes", "", ""]); // missing codes -> blank, row kept
  });
});
