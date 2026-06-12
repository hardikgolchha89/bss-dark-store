// Procurement stage: consolidate the run's total requirement and emit a Material
// Request file per source place (Mithai / Packaging / Retail) in the exact ERPNext
// import template. For now each file holds the FULL consolidated list with that
// place as Source Warehouse; the team deletes rows that aren't theirs.
import { Partner } from "@prisma/client";
import Papa from "papaparse";
import { prisma } from "./prisma";
import type { ExportFile } from "./run-engine";
import { MR_PREAMBLE, MR_COLS, MR_IDX } from "./mr-template";

export interface ConsolidatedLine {
  itemId: string;
  sku: string; // HK sku
  name: string;
  category: string;
  erpnextCode: string | null;
  total: number; // Σ adjusted across all stores
}

// Total requirement per item across every store (adjusted > 0).
export async function buildConsolidated(runId: string): Promise<ConsolidatedLine[]> {
  const reqs = await prisma.runRequirement.findMany({
    where: { runId, adjusted: { gt: 0 } },
    include: { item: { include: { partnerSkus: { where: { partner: Partner.HK } } } } },
  });
  const byItem = new Map<string, ConsolidatedLine>();
  for (const r of reqs) {
    const g = byItem.get(r.itemId) ?? {
      itemId: r.itemId,
      sku: r.item.partnerSkus[0]?.skuCode ?? "",
      name: r.item.name,
      category: r.item.category ?? "",
      erpnextCode: r.item.erpnextCode,
      total: 0,
    };
    g.total += r.adjusted;
    byItem.set(r.itemId, g);
  }
  return [...byItem.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface ProcurementSummary {
  sources: { id: string; name: string; erpnextWarehouseId: string | null }[];
  itemCount: number;
  totalUnits: number;
  itemsMissingErpCode: number;
}

export async function getProcurementSummary(runId: string): Promise<ProcurementSummary> {
  const [consolidated, sources] = await Promise.all([
    buildConsolidated(runId),
    prisma.materialSource.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return {
    sources: sources.map((s) => ({ id: s.id, name: s.name, erpnextWarehouseId: s.erpnextWarehouseId })),
    itemCount: consolidated.length,
    totalUnits: consolidated.reduce((a, l) => a + l.total, 0),
    itemsMissingErpCode: consolidated.filter((l) => !l.erpnextCode).length,
  };
}

function ddmmyyyy(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}-${mon}-${d.getUTCFullYear()}`;
}

// Build the Material Request file for one source place: full consolidated list,
// in the exact ERPNext template (preset header rows preserved). Only item_code,
// item_name, qty, and Source Warehouse are filled; the rest are intentionally blank.
export async function buildMaterialRequestExport(
  runId: string,
  sourceId: string,
): Promise<ExportFile> {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  const source = await prisma.materialSource.findUniqueOrThrow({ where: { id: sourceId } });
  const lines = await buildConsolidated(runId);
  const schedule = ddmmyyyy(run.runDate);

  const rows: string[][] = MR_PREAMBLE.map((r) => [...r]);
  for (const l of lines) {
    if (l.total <= 0) continue;
    const row = new Array<string>(MR_COLS).fill("");
    row[MR_IDX.item_code] = l.erpnextCode ?? "";
    row[MR_IDX.item_name] = l.name;
    row[MR_IDX.qty] = String(l.total);
    row[MR_IDX.stock_uom] = "Nos";
    row[MR_IDX.uom] = "Nos";
    row[MR_IDX.conversion_factor] = "1";
    row[MR_IDX.from_warehouse] = source.erpnextWarehouseId ?? "";
    row[MR_IDX.schedule_date] = schedule;
    rows.push(row);
  }

  const csv = Papa.unparse(rows, { quotes: true });
  const safe = source.name.replace(/[^a-z0-9]+/gi, "_");
  return {
    filename: `MaterialRequest_${safe}_${run.runDate.toISOString().slice(0, 10)}.csv`,
    buffer: Buffer.from(csv, "utf-8"),
    contentType: "text/csv",
  };
}
