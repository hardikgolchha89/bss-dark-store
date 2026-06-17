// ERPNext Stock Entry (Material Transfer) export in the full ERPNext import
// template. Preset header rows preserved; only the transfer columns are filled
// (s_warehouse, t_warehouse, item_code, item_name, qty, transfer_qty, UOMs).
import Papa from "papaparse";
import { STE_PREAMBLE, STE_COLS, STE_IDX } from "./ste-template";

export interface SteLine {
  tWarehouse: string;
  itemCode: string;
  itemName: string;
  qty: number;
}

export function buildSteCsv(lines: SteLine[], sourceWarehouse: string): string {
  const rows: string[][] = STE_PREAMBLE.map((r) => [...r]);
  for (const l of lines) {
    if (l.qty <= 0) continue;
    const row = new Array<string>(STE_COLS).fill("");
    row[STE_IDX.s_warehouse] = sourceWarehouse;
    row[STE_IDX.t_warehouse] = l.tWarehouse;
    row[STE_IDX.item_code] = l.itemCode;
    row[STE_IDX.item_name] = l.itemName;
    row[STE_IDX.qty] = String(l.qty);
    row[STE_IDX.transfer_qty] = String(l.qty);
    row[STE_IDX.uom] = "Nos";
    row[STE_IDX.stock_uom] = "Nos";
    row[STE_IDX.conversion_factor] = "1";
    rows.push(row);
  }
  return Papa.unparse(rows, { quotes: true });
}
