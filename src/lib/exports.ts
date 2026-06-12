// Export builders. Pure: take resolved line data, return rows / buffers.
// The DB layer assembles the lines, these shape the files.
import * as XLSX from "xlsx";

// ---- Purchase Order (Kytchens / CZ / Rebel share this layout) -------------
// Exact columns required by the partner template.
export const PO_HEADER = [
  "SKU",
  "Name",
  "Remarks",
  "Unit",
  "Ordered Unit Quantity",
  "Unit Cost",
] as const;

export interface POLine {
  skuCode: string;
  name: string;
  unit: string;
  qty: number;
}

export function buildPORows(lines: POLine[]): (string | number)[][] {
  const rows: (string | number)[][] = [[...PO_HEADER]];
  for (const l of lines) {
    if (l.qty <= 0) continue; // no point ordering zero
    rows.push([l.skuCode, l.name, "", l.unit, l.qty, 1]); // Unit Cost = 1 placeholder
  }
  return rows;
}

// ---- ERPNext Stock Entry (Material Transfer) ------------------------------
export const ERP_HEADER = [
  "barcode",
  "has_item_scanned",
  "s_warehouse",
  "t_warehouse",
  "item_code",
  "qty",
  "uom",
  "stock_uom",
  "conversion_factor",
] as const;

export interface ErpLine {
  tWarehouse: string; // store's ERPNext warehouse
  itemCode: string; // ERPNext item_code
  qty: number;
}

export function buildErpRows(lines: ErpLine[], sourceWarehouse: string): (string | number)[][] {
  const rows: (string | number)[][] = [[...ERP_HEADER]];
  for (const l of lines) {
    if (l.qty <= 0) continue;
    rows.push(["", "", sourceWarehouse, l.tWarehouse, l.itemCode, l.qty, "Nos", "Nos", 1]);
  }
  return rows;
}

// ---- Consolidated printout (replaces "Order Sheet for Printout") ----------
export interface ConsolidatedLine {
  skuCode: string;
  name: string;
  category: string;
  total: number;
}

export function buildConsolidatedRows(lines: ConsolidatedLine[]): (string | number)[][] {
  const rows: (string | number)[][] = [["SKU", "Name", "Category", "Total Qty"]];
  for (const l of lines) {
    if (l.total <= 0) continue;
    rows.push([l.skuCode, l.name, l.category, l.total]);
  }
  return rows;
}

// ---- serializers ----------------------------------------------------------
export function toXlsxBuffer(rows: (string | number)[][], sheetName = "Sheet1"): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function toCsvString(rows: (string | number)[][]): string {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  return XLSX.utils.sheet_to_csv(ws);
}
