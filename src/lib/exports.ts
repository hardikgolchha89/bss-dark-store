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

// ---- Rebel PO ("BSS Ordering Working Sheet" format) -----------------------
// Rebel's own ordering sheet. Invoice_Number = the ERP stock-entry number the
// user types at download time (Rebel isn't wired to ERP). Kitchen_Code = store
// code; rebel_inventory_code = the item's Rebel SKU.
export const REBEL_PO_HEADER = [
  "Invoice_Number",
  "Dispatch_Date",
  "Planned_Delivery_Date",
  "Kitchen_Code",
  "Store_Name",
  "rebel_inventory_code",
  "Product_Name",
  "batch_id",
  "dispatch_quantity",
  "Remark",
] as const;

export interface RebelPoLine {
  kitchenCode: string;
  storeName: string;
  invCode: string; // rebel inventory code (= rebel sku)
  productName: string;
  qty: number;
}

export interface RebelPoMeta {
  invoice: string;
  dispatchDate: string; // dd/mm/yy
  deliveryDate: string; // dd/mm/yy
}

export function buildRebelPoRows(lines: RebelPoLine[], meta: RebelPoMeta): (string | number)[][] {
  const rows: (string | number)[][] = [[...REBEL_PO_HEADER]];
  for (const l of lines) {
    if (l.qty <= 0) continue;
    rows.push([
      meta.invoice,
      meta.dispatchDate,
      meta.deliveryDate,
      l.kitchenCode,
      l.storeName,
      l.invCode,
      l.productName,
      "", // batch_id
      l.qty,
      "", // Remark
    ]);
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
