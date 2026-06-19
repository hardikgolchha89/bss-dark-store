// DB-backed replenishment engine. Builds on the pure math in requirement.ts.
import { Partner, Prisma, RunStatus, StockSource } from "@prisma/client";
import { prisma } from "./prisma";
import { resolvePar, suggestedQty } from "./requirement";
import {
  buildConsolidatedRows,
  buildPORows,
  buildRebelPoRows,
  toCsvString,
  toXlsxBuffer,
  type ConsolidatedLine,
  type POLine,
  type RebelPoLine,
} from "./exports";
import { buildSteCsv, type SteLine } from "./ste";
import { asBool, defaultsByKey } from "./settings";

// ---- settings -------------------------------------------------------------
export async function getSettingsMap(): Promise<Record<string, string>> {
  const defaults = defaultsByKey();
  const rows = await prisma.setting.findMany();
  const map = { ...defaults };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

// Weekend/peak buffer % for a run, from its day type + admin settings.
export async function getRunBufferPct(runId: string): Promise<number> {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  if (run.dayType === "NORMAL") return 0;
  const s = await getSettingsMap();
  const key = run.dayType === "WEEKEND" ? "weekend_buffer_pct" : "peak_buffer_pct";
  return Math.max(0, Number(s[key]) || 0);
}

function bufferedPar(par: number, bufferPct: number): number {
  return Math.round(par * (1 + bufferPct / 100));
}

// ---- draft recompute (per store: fast, called after each upload) -----------
export async function recomputeStore(
  runId: string,
  storeId: string,
  bufferPct?: number,
): Promise<void> {
  const pct = bufferPct ?? (await getRunBufferPct(runId));
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });

  const [stocks, overrides, templates] = await Promise.all([
    prisma.runStock.findMany({ where: { runId, storeId } }),
    prisma.parOverride.findMany({ where: { storeId } }),
    prisma.parTemplate.findMany({ where: { tier: store.tier } }),
  ]);

  const liveByItem = new Map(stocks.map((s) => [s.itemId, s.liveQty]));
  const overrideByItem = new Map(overrides.map((o) => [o.itemId, o.qty]));
  const templateByItem = new Map(templates.map((t) => [t.itemId, t.qty]));

  // line set = items with stock OR an override OR a tier template
  const itemIds = new Set<string>([
    ...liveByItem.keys(),
    ...overrideByItem.keys(),
    ...templateByItem.keys(),
  ]);
  // inactive items are excluded from runs entirely (existing lines get dropped below)
  const active = await prisma.item.findMany({
    where: { id: { in: [...itemIds] }, active: true },
    select: { id: true },
  });
  const activeSet = new Set(active.map((i) => i.id));
  for (const id of itemIds) if (!activeSet.has(id)) itemIds.delete(id);

  const existing = await prisma.runRequirement.findMany({ where: { runId, storeId } });
  const existingByItem = new Map(existing.map((e) => [e.itemId, e]));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const itemId of itemIds) {
    const basePar = resolvePar(overrideByItem.get(itemId), templateByItem.get(itemId));
    const par = bufferedPar(basePar, pct); // effective par after weekend/peak buffer
    const live = liveByItem.get(itemId) ?? 0;
    const suggested = suggestedQty(par, live);
    const prev = existingByItem.get(itemId);
    if (prev) {
      ops.push(
        prisma.runRequirement.update({
          where: { id: prev.id },
          data: {
            parUsed: par,
            liveUsed: live,
            suggested,
            adjusted: prev.edited ? prev.adjusted : suggested,
          },
        }),
      );
    } else {
      ops.push(
        prisma.runRequirement.create({
          data: { runId, storeId, itemId, parUsed: par, liveUsed: live, suggested, adjusted: suggested },
        }),
      );
    }
  }
  // drop lines no longer relevant (no stock, no par)
  for (const e of existing) {
    if (!itemIds.has(e.itemId)) ops.push(prisma.runRequirement.delete({ where: { id: e.id } }));
  }
  await prisma.$transaction(ops);
}

// Non-HK partners (CZ / Rebel) have no live stock feed. We assume their live
// stock is 0 so suggested = par, and the user fulfills by editing adjusted.
// Idempotent: only seeds a store that has no requirement lines in this run yet,
// so it never clobbers edits or re-adds removed lines.
export async function ensureManualStores(runId: string): Promise<void> {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  if (run.status === RunStatus.FINALIZED) return;

  const stores = await prisma.store.findMany({
    where: { active: true, partner: { not: Partner.HK } },
  });
  if (stores.length === 0) return;

  const seeded = await prisma.runRequirement.groupBy({
    by: ["storeId"],
    where: { runId },
  });
  const haveLines = new Set(seeded.map((s) => s.storeId));
  const todo = stores.filter((s) => !haveLines.has(s.id));
  if (todo.length === 0) return;

  const pct = await getRunBufferPct(runId);
  for (const s of todo) await recomputeStore(runId, s.id, pct);
}

export async function recomputeAll(runId: string): Promise<void> {
  const pct = await getRunBufferPct(runId);
  // Every store in the run = HK stores with uploaded stock UNION the manual
  // (CZ/Rebel) stores seeded at live=0. Deriving only from runStock skipped the
  // manual stores, so day-type buffers never reached them.
  const [stockStores, manualStores] = await Promise.all([
    prisma.runStock.findMany({ where: { runId }, distinct: ["storeId"], select: { storeId: true } }),
    prisma.store.findMany({ where: { active: true, partner: { not: Partner.HK } }, select: { id: true } }),
  ]);
  const storeIds = new Set<string>([...stockStores.map((s) => s.storeId), ...manualStores.map((s) => s.id)]);
  for (const storeId of storeIds) await recomputeStore(runId, storeId, pct);
}

// Change a run's day type (Normal/Weekend/Peak) and re-apply the buffer.
export async function setRunDayType(runId: string, dayType: "NORMAL" | "WEEKEND" | "PEAK"): Promise<void> {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  if (run.status === RunStatus.FINALIZED) throw new Error("Run is finalized.");
  await prisma.run.update({ where: { id: runId }, data: { dayType } });
  await recomputeAll(runId);
}

// ---- ingest one store's Prime stock ---------------------------------------
export interface IngestResult {
  storeId: string;
  matched: number;
  unmapped: number;
  anomalies: number;
}

export async function ingestStock(
  runId: string,
  storeId: string,
  partner: Partner,
  rows: { skuCode: string; name: string; liveQty: number }[],
  source: StockSource,
): Promise<IngestResult> {
  // map partner skus -> item
  const skuRows = await prisma.itemPartnerSku.findMany({ where: { partner } });
  const skuToItem = new Map(skuRows.map((s) => [s.skuCode, s.itemId]));

  let matched = 0;
  let unmapped = 0;
  let anomalies = 0;

  for (const r of rows) {
    const itemId = skuToItem.get(r.skuCode);
    if (r.liveQty < 0) anomalies++;
    if (!itemId) {
      unmapped++;
      await prisma.unmappedSku.upsert({
        where: { runId_partner_skuCode: { runId, partner, skuCode: r.skuCode } },
        update: { rawName: r.name, liveQty: r.liveQty },
        create: { runId, partner, skuCode: r.skuCode, rawName: r.name, liveQty: r.liveQty },
      });
      continue;
    }
    matched++;
    await prisma.runStock.upsert({
      where: { runId_storeId_itemId: { runId, storeId, itemId } },
      update: { liveQty: r.liveQty, source },
      create: { runId, storeId, itemId, liveQty: r.liveQty, source },
    });
  }
  await recomputeStore(runId, storeId);
  return { storeId, matched, unmapped, anomalies };
}

// ---- adjusted edit (optimistic concurrency) -------------------------------
export class ConcurrencyError extends Error {}

export async function setAdjusted(
  reqId: string,
  qty: number,
  expectedUpdatedAt: Date,
): Promise<Date> {
  const result = await prisma.runRequirement.updateMany({
    where: { id: reqId, updatedAt: expectedUpdatedAt },
    data: { adjusted: Math.max(0, Math.round(qty)), edited: true },
  });
  if (result.count === 0) {
    throw new ConcurrencyError("This line was changed by someone else. Refresh and retry.");
  }
  // return the row's fresh updatedAt so the client can edit the same cell again
  const row = await prisma.runRequirement.findUniqueOrThrow({
    where: { id: reqId },
    select: { updatedAt: true },
  });
  return row.updatedAt;
}

// ---- procurement -> distribution gate -------------------------------------
export async function markReceived(runId: string): Promise<void> {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  if (run.phase === "DISTRIBUTION") return;
  await prisma.run.update({
    where: { id: runId },
    data: { phase: "DISTRIBUTION", receivedAt: new Date() },
  });
}

export async function reopenProcurement(runId: string): Promise<void> {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  if (run.status === RunStatus.FINALIZED) throw new Error("Run is finalized.");
  await prisma.run.update({
    where: { id: runId },
    data: { phase: "PROCUREMENT", receivedAt: null },
  });
}

// ---- finalize -------------------------------------------------------------
export async function finalizeRun(runId: string): Promise<void> {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  if (run.status === RunStatus.FINALIZED) return;

  const settings = await getSettingsMap();
  if (asBool(settings.block_finalize_on_unmapped)) {
    const unresolved = await prisma.unmappedSku.count({
      where: { runId, resolvedItemId: null, ignored: false },
    });
    if (unresolved > 0) {
      throw new Error(`${unresolved} unmapped SKU(s) must be resolved before finalize.`);
    }
  }
  await recomputeAll(runId); // freeze fresh numbers
  await prisma.run.update({
    where: { id: runId },
    data: { status: RunStatus.FINALIZED, finalizedAt: new Date() },
  });
}

// ---- exports --------------------------------------------------------------
export interface ExportFile {
  filename: string;
  buffer: Buffer;
  contentType: string;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function dateTag(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// dd/mm/yy — the date format Rebel's working sheet uses (e.g. 17/06/26).
function ddmmyy(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

function safeName(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}

// PO workbook: one sheet per store, in the exact partner column layout.
export async function buildPOExport(runId: string, partner: Partner): Promise<ExportFile> {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  const reqs = await prisma.runRequirement.findMany({
    where: { runId, store: { partner }, adjusted: { gt: 0 }, removed: false },
    include: {
      store: true,
      item: { include: { partnerSkus: { where: { partner } } } },
    },
    orderBy: [{ store: { sortOrder: "asc" } }, { item: { name: "asc" } }],
  });

  const byStore = new Map<string, { name: string; lines: POLine[] }>();
  for (const r of reqs) {
    const sku = r.item.partnerSkus[0]?.skuCode;
    if (!sku) continue; // no partner code -> excluded (flagged elsewhere)
    const g = byStore.get(r.storeId) ?? { name: r.store.name, lines: [] };
    g.lines.push({ skuCode: sku, name: r.item.name, unit: r.item.unit, qty: r.adjusted });
    byStore.set(r.storeId, g);
  }

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  if (byStore.size === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildPORows([])), "empty");
  }
  for (const { name, lines } of byStore.values()) {
    const ws = XLSX.utils.aoa_to_sheet(buildPORows(lines));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return {
    filename: `PO_${partner}_${dateTag(run.runDate)}.xlsx`,
    buffer,
    contentType: XLSX_MIME,
  };
}

// ERPNext Stock Entry (Material Transfer): single CSV across all stores.
export async function buildErpExport(runId: string): Promise<ExportFile> {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  const settings = await getSettingsMap();
  const source = settings.erpnext_source_warehouse;

  const reqs = await prisma.runRequirement.findMany({
    where: { runId, adjusted: { gt: 0 }, removed: false, item: { erpnextCode: { not: null } } },
    include: { store: true, item: true },
    orderBy: [{ store: { sortOrder: "asc" } }, { item: { name: "asc" } }],
  });

  const lines: SteLine[] = [];
  for (const r of reqs) {
    if (!r.store.erpnextWarehouseId || !r.item.erpnextCode) continue;
    lines.push({ tWarehouse: r.store.erpnextWarehouseId, itemCode: r.item.erpnextCode, itemName: r.item.name, qty: r.adjusted });
  }
  const csv = buildSteCsv(lines, source);
  return {
    filename: `ERPNext_StockEntry_${dateTag(run.runDate)}.csv`,
    buffer: Buffer.from(csv, "utf-8"),
    contentType: "text/csv",
  };
}

// Prime POs as a ZIP of one Kytchens-PO .xlsx per store (each keyed by that
// store's partner SKU). CZ/Rebel stores included only if their flag is enabled.
export async function buildPrimePoZip(runId: string): Promise<ExportFile> {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  const settings = await getSettingsMap();
  const enabledPartners = new Set<Partner>([Partner.HK]);
  if (asBool(settings.cz_export_enabled)) enabledPartners.add(Partner.CZ);
  if (asBool(settings.rebel_export_enabled)) enabledPartners.add(Partner.REBEL);

  const reqs = await prisma.runRequirement.findMany({
    where: { runId, adjusted: { gt: 0 }, removed: false },
    include: { store: true, item: { include: { partnerSkus: true } } },
    orderBy: [{ store: { sortOrder: "asc" } }, { item: { name: "asc" } }],
  });

  const byStore = new Map<string, { name: string; lines: POLine[] }>();
  for (const r of reqs) {
    if (!enabledPartners.has(r.store.partner)) continue;
    const sku = r.item.partnerSkus.find((p) => p.partner === r.store.partner)?.skuCode;
    if (!sku) continue;
    const g = byStore.get(r.storeId) ?? { name: r.store.name, lines: [] };
    g.lines.push({ skuCode: sku, name: r.item.name, unit: r.item.unit, qty: r.adjusted });
    byStore.set(r.storeId, g);
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const { name, lines } of byStore.values()) {
    if (!lines.length) continue;
    zip.file(`PO_${safeName(name)}.xlsx`, toXlsxBuffer(buildPORows(lines), name));
  }
  const buffer = (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
  return {
    filename: `PrimePOs_${dateTag(run.runDate)}.zip`,
    buffer,
    contentType: "application/zip",
  };
}

// Rebel POs as a ZIP of one "BSS Ordering Working Sheet" CSV per Rebel store.
// `invoice` is the ERP stock-entry number the user supplies at download time
// (Rebel isn't connected to ERP) and is stamped on every row.
export async function buildRebelPoZip(runId: string, invoice: string): Promise<ExportFile> {
  const inv = invoice.trim();
  if (!inv) throw new Error("A stock-entry / invoice number is required for Rebel POs.");
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  const date = ddmmyy(run.runDate);

  const reqs = await prisma.runRequirement.findMany({
    where: { runId, store: { partner: Partner.REBEL }, adjusted: { gt: 0 }, removed: false },
    include: { store: true, item: { include: { partnerSkus: { where: { partner: Partner.REBEL } } } } },
    orderBy: [{ store: { sortOrder: "asc" } }, { item: { name: "asc" } }],
  });

  const byStore = new Map<string, { name: string; lines: RebelPoLine[] }>();
  for (const r of reqs) {
    const psku = r.item.partnerSkus[0];
    if (!psku) continue; // no Rebel SKU -> can't order from Rebel (flagged in Items)
    const g = byStore.get(r.storeId) ?? { name: r.store.name, lines: [] };
    g.lines.push({
      kitchenCode: r.store.code ?? "",
      storeName: r.store.name,
      invCode: psku.skuCode,
      productName: psku.productName ?? r.item.name,
      qty: r.adjusted,
    });
    byStore.set(r.storeId, g);
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const { name, lines } of byStore.values()) {
    if (!lines.length) continue;
    const rows = buildRebelPoRows(lines, { invoice: inv, dispatchDate: date, deliveryDate: date });
    zip.file(`Rebel_PO_${safeName(name)}.csv`, toCsvString(rows));
  }
  const buffer = (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
  return {
    filename: `Rebel_POs_${dateTag(run.runDate)}.zip`,
    buffer,
    contentType: "application/zip",
  };
}

// ERPNext stock entries as a ZIP of one Material-Transfer CSV per store.
export async function buildErpZip(runId: string): Promise<ExportFile> {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  const settings = await getSettingsMap();
  const source = settings.erpnext_source_warehouse;

  const reqs = await prisma.runRequirement.findMany({
    where: { runId, adjusted: { gt: 0 }, removed: false, item: { erpnextCode: { not: null } } },
    include: { store: true, item: true },
    orderBy: [{ store: { sortOrder: "asc" } }, { item: { name: "asc" } }],
  });

  const byStore = new Map<string, { name: string; lines: SteLine[] }>();
  for (const r of reqs) {
    if (!r.store.erpnextWarehouseId || !r.item.erpnextCode) continue;
    const g = byStore.get(r.storeId) ?? { name: r.store.name, lines: [] };
    g.lines.push({ tWarehouse: r.store.erpnextWarehouseId, itemCode: r.item.erpnextCode, itemName: r.item.name, qty: r.adjusted });
    byStore.set(r.storeId, g);
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const { name, lines } of byStore.values()) {
    if (!lines.length) continue;
    zip.file(`ERP_${safeName(name)}.csv`, buildSteCsv(lines, source));
  }
  const buffer = (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
  return {
    filename: `ERPNextStockEntries_${dateTag(run.runDate)}.zip`,
    buffer,
    contentType: "application/zip",
  };
}

// Consolidated printout: total adjusted per item across all stores.
export async function buildConsolidatedExport(runId: string): Promise<ExportFile> {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  const reqs = await prisma.runRequirement.findMany({
    where: { runId, adjusted: { gt: 0 }, removed: false },
    include: { item: { include: { partnerSkus: { where: { partner: Partner.HK } } } } },
  });
  const byItem = new Map<string, ConsolidatedLine>();
  for (const r of reqs) {
    const g = byItem.get(r.itemId) ?? {
      skuCode: r.item.partnerSkus[0]?.skuCode ?? "",
      name: r.item.name,
      category: r.item.category ?? "",
      total: 0,
    };
    g.total += r.adjusted;
    byItem.set(r.itemId, g);
  }
  const lines = [...byItem.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    filename: `Consolidated_${dateTag(run.runDate)}.xlsx`,
    buffer: toXlsxBuffer(buildConsolidatedRows(lines), "Consolidated"),
    contentType: XLSX_MIME,
  };
}
