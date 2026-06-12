// Parse a Prime (HK/CZ) stock export. Accepts .csv or .xlsx (drag-drop).
// Columns we rely on: Location, Sku, Product, Unit Count (= live stock).
// Everything else in the Prime export (Unit Weighted Cost, Unit Par Level,
// Category) is junk and ignored — cost/par/category come from the app.
import * as XLSX from "xlsx";
import { canonicalSku, cleanProductName } from "./sku";

export interface PrimeRow {
  skuCode: string;
  name: string;
  liveQty: number;
}

export interface PrimeParseResult {
  locationRaw: string; // the Location cell value, e.g. "Bombay Sweet Shop Inventory - BKC"
  rows: PrimeRow[];
  errors: string[];
}

const REQUIRED = ["sku", "unit count"];

function norm(h: unknown): string {
  return String(h ?? "").trim().toLowerCase();
}

// Duplicate Sku rows within one file are SUMMED (Prime sometimes splits a SKU
// across rows). See replenishment-tool-brief.md open-impl-decision.
export function parsePrimeBuffer(buf: ArrayBuffer | Buffer): PrimeParseResult {
  const wb = XLSX.read(buf, { type: "buffer", raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const errors: string[] = [];

  // find header row: the one containing both "sku" and "unit count"
  const headerIdx = aoa.findIndex((r) => {
    const cells = (r ?? []).map(norm);
    return cells.includes("sku") && cells.includes("unit count");
  });
  if (headerIdx < 0) {
    return {
      locationRaw: "",
      rows: [],
      errors: [`Could not find a header row with columns: ${REQUIRED.join(", ")}.`],
    };
  }
  const header = aoa[headerIdx].map(norm);
  const idx = {
    location: header.indexOf("location"),
    sku: header.indexOf("sku"),
    product: header.indexOf("product"),
    count: header.indexOf("unit count"),
  };

  let locationRaw = "";
  const merged = new Map<string, PrimeRow>();
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r) continue;
    const sku = canonicalSku(r[idx.sku]);
    if (!sku) continue;
    if (!locationRaw && idx.location >= 0) locationRaw = String(r[idx.location] ?? "").trim();
    const name = idx.product >= 0 ? cleanProductName(r[idx.product]) : "";
    const raw = r[idx.count];
    const qty = Math.round(Number(raw));
    if (!Number.isFinite(qty)) continue;
    const existing = merged.get(sku);
    if (existing) existing.liveQty += qty;
    else merged.set(sku, { skuCode: sku, name, liveQty: qty });
  }

  if (merged.size === 0) errors.push("No data rows found below the header.");
  return { locationRaw, rows: [...merged.values()], errors };
}
