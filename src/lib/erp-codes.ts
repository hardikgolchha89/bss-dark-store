// Import ERP item codes from the "HK SKU → ERP Item mapping" sheet.
// Keyed by HK SKU; writes item.erpnextCode. Tolerant of the messy export:
// finds the header row anywhere, and extracts just the code token from cells
// that have a trailing note (e.g. "MITH-ASM-3PCS this will come on ERP soon…").
import { Partner } from "@prisma/client";
import { prisma } from "./prisma";
import { canonicalSku } from "./sku";

export interface ErpCodeResult {
  updated: number;
  unmatchedSkus: number;
  blankCodes: number;
  rows: number;
  warnings: string[];
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

// First code-like token: letters/digits with hyphens/underscores.
function extractCode(cell: unknown): string {
  const m = String(cell ?? "").trim().match(/^[A-Za-z0-9][A-Za-z0-9._-]*/);
  return m ? m[0] : "";
}

export async function applyErpCodeMapping(aoa: unknown[][]): Promise<ErpCodeResult> {
  const res: ErpCodeResult = { updated: 0, unmatchedSkus: 0, blankCodes: 0, rows: 0, warnings: [] };

  const headerIdx = aoa.findIndex((r) => {
    const cells = (r ?? []).map(norm);
    return cells.includes("hk sku") && cells.includes("erp item code");
  });
  if (headerIdx < 0) {
    res.warnings.push('Could not find a header row with "HK SKU" and "ERP Item Code".');
    return res;
  }
  const header = aoa[headerIdx].map(norm);
  const hkIdx = header.indexOf("hk sku");
  const erpIdx = header.indexOf("erp item code");

  // load HK sku -> itemId once
  const hkSkus = await prisma.itemPartnerSku.findMany({ where: { partner: Partner.HK } });
  const skuToItem = new Map(hkSkus.map((s) => [s.skuCode, s.itemId]));

  const seen = new Set<string>();
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r) continue;
    const hk = canonicalSku(r[hkIdx]);
    if (!hk || seen.has(hk)) continue;
    seen.add(hk);
    res.rows++;

    const code = extractCode(r[erpIdx]);
    if (!code) { res.blankCodes++; continue; }
    const itemId = skuToItem.get(hk);
    if (!itemId) { res.unmatchedSkus++; continue; }

    await prisma.item.update({ where: { id: itemId }, data: { erpnextCode: code } });
    res.updated++;
  }
  return res;
}
