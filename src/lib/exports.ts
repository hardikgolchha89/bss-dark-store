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

// ---- Consolidated grid (store columns × item rows) ------------------------
// Same pivot as the on-screen requirement matrix, but a single number per cell:
// the adjusted (actual-sent) quantity. Blank where nothing is sent to a store.
export interface MatrixStore {
  id: string;
  name: string;
}
export interface MatrixItem {
  skuCode: string;
  name: string;
  category: string;
  qtyByStore: Record<string, number>; // storeId -> adjusted qty
}

export function buildMatrixRows(items: MatrixItem[], stores: MatrixStore[]): (string | number)[][] {
  const header = ["SKU", "Name", "Category", ...stores.map((s) => s.name), "Total"];
  const rows: (string | number)[][] = [header];
  const colTotals = new Array(stores.length).fill(0);
  let grand = 0;
  for (const it of items) {
    let rowTotal = 0;
    const cells: (string | number)[] = stores.map((s, i) => {
      const q = it.qtyByStore[s.id] ?? 0;
      colTotals[i] += q;
      rowTotal += q;
      return q > 0 ? q : ""; // blank, not 0, so the printout only shows real sends
    });
    if (rowTotal <= 0) continue; // drop items sent nowhere
    grand += rowTotal;
    rows.push([it.skuCode, it.name, it.category, ...cells, rowTotal]);
  }
  rows.push(["", "Total", "", ...colTotals.map((t) => (t > 0 ? t : "")), grand]);
  return rows;
}

// ---- Items master (SKU cross-reference) -----------------------------------
export interface ItemCsvLine {
  hkSku: string;
  name: string;
  erpnextCode: string;
  rebelSku: string;
}

export function buildItemsCsvRows(items: ItemCsvLine[]): (string | number)[][] {
  const rows: (string | number)[][] = [["HK SKU", "Name", "ERPNext Code", "Rebel SKU"]];
  for (const it of items) {
    rows.push([it.hkSku, it.name, it.erpnextCode, it.rebelSku]);
  }
  return rows;
}

// ---- serializers ----------------------------------------------------------
// CSV only — all downloads in this app are CSV, never xlsx. (xlsx is still an
// accepted *upload* format; that parsing lives in prime-csv.ts / par actions.)
export function toCsvString(rows: (string | number)[][]): string {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  return XLSX.utils.sheet_to_csv(ws);
}
