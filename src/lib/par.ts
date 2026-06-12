// Par matrix helpers: resolve effective pars for every item × store, build the
// downloadable template, and apply a bulk upload.
//
// Effective par = override(item,store) ?? template(item, store.tier) ?? 0
// On bulk upload: a value equal to the tier default INHERITS (override removed);
// a different value becomes a per-store override. Keeps the tier model clean.
import { Partner, Tier } from "@prisma/client";
import { prisma } from "./prisma";
import { canonicalSku } from "./sku";

export interface ParMatrixStore {
  id: string;
  name: string;
  partner: Partner;
  tier: Tier;
}
export interface ParMatrixRow {
  itemId: string;
  sku: string;
  name: string;
  category: string;
  pars: number[]; // aligned to stores order
}
export interface ParMatrix {
  stores: ParMatrixStore[];
  rows: ParMatrixRow[];
}

export async function buildParMatrix(): Promise<ParMatrix> {
  const [stores, items, templates, overrides] = await Promise.all([
    prisma.store.findMany({ where: { active: true }, orderBy: [{ partner: "asc" }, { sortOrder: "asc" }] }),
    prisma.item.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { partnerSkus: { where: { partner: Partner.HK } } },
    }),
    prisma.parTemplate.findMany(),
    prisma.parOverride.findMany(),
  ]);

  const tmpl = new Map<string, number>(); // `${itemId}:${tier}`
  for (const t of templates) tmpl.set(`${t.itemId}:${t.tier}`, t.qty);
  const ovr = new Map<string, number>(); // `${itemId}:${storeId}`
  for (const o of overrides) ovr.set(`${o.itemId}:${o.storeId}`, o.qty);

  const rows: ParMatrixRow[] = items.map((it) => ({
    itemId: it.id,
    sku: it.partnerSkus[0]?.skuCode ?? "",
    name: it.name,
    category: it.category ?? "",
    pars: stores.map((s) => {
      const o = ovr.get(`${it.id}:${s.id}`);
      if (o !== undefined) return o;
      return tmpl.get(`${it.id}:${s.tier}`) ?? 0;
    }),
  }));

  return {
    stores: stores.map((s) => ({ id: s.id, name: s.name, partner: s.partner, tier: s.tier })),
    rows,
  };
}

export const PAR_FIXED_COLS = ["HK SKU", "Item", "Category"] as const;

// Build the template / current-state matrix as rows-of-cells (for xlsx).
export async function buildParTemplateRows(): Promise<(string | number)[][]> {
  const m = await buildParMatrix();
  const header: (string | number)[] = [...PAR_FIXED_COLS, ...m.stores.map((s) => s.name)];
  const out: (string | number)[][] = [header];
  for (const r of m.rows) {
    out.push([r.sku, r.name, r.category, ...r.pars]);
  }
  return out;
}

export interface ParUploadResult {
  itemsMatched: number;
  itemsUnmatched: string[];
  storeColumns: number;
  unknownColumns: string[];
  overridesSet: number;
  inherited: number;
}

// Apply a bulk par upload (rows-of-cells, same shape as the template).
export async function applyParUpload(aoa: unknown[][]): Promise<ParUploadResult> {
  const header = (aoa[0] ?? []).map((c) => String(c ?? "").trim());
  // first 3 columns are fixed; the rest are store-name columns
  const storeCols = header.slice(PAR_FIXED_COLS.length);

  const stores = await prisma.store.findMany();
  const byName = new Map(stores.map((s) => [s.name.trim().toLowerCase(), s]));
  const colToStore = storeCols.map((name) => byName.get(name.trim().toLowerCase()) ?? null);
  const unknownColumns = storeCols.filter((_, i) => !colToStore[i]);

  const hkSkus = await prisma.itemPartnerSku.findMany({ where: { partner: Partner.HK } });
  const skuToItem = new Map(hkSkus.map((s) => [s.skuCode, s.itemId]));
  const templates = await prisma.parTemplate.findMany();
  const tmpl = new Map(templates.map((t) => [`${t.itemId}:${t.tier}`, t.qty]));

  const result: ParUploadResult = {
    itemsMatched: 0,
    itemsUnmatched: [],
    storeColumns: storeCols.length,
    unknownColumns,
    overridesSet: 0,
    inherited: 0,
  };

  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row) continue;
    const sku = canonicalSku(row[0]);
    if (!sku) continue;
    const itemId = skuToItem.get(sku);
    if (!itemId) {
      result.itemsUnmatched.push(sku);
      continue;
    }
    result.itemsMatched++;

    for (let c = 0; c < colToStore.length; c++) {
      const store = colToStore[c];
      if (!store) continue;
      const raw = row[PAR_FIXED_COLS.length + c];
      if (raw === null || raw === undefined || String(raw).trim() === "") continue; // blank = leave unchanged
      const qty = Math.max(0, Math.round(Number(raw)));
      if (!Number.isFinite(qty)) continue;

      const tier = store.tier;
      const tplQty = tmpl.get(`${itemId}:${tier}`);
      if (tplQty !== undefined && qty === tplQty) {
        // matches tier default -> inherit (remove any override)
        await prisma.parOverride.deleteMany({ where: { itemId, storeId: store.id } });
        result.inherited++;
      } else {
        await prisma.parOverride.upsert({
          where: { itemId_storeId: { itemId, storeId: store.id } },
          update: { qty },
          create: { itemId, storeId: store.id, qty },
        });
        result.overridesSet++;
      }
    }
  }
  return result;
}
