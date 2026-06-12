// Two-way sync between the DB and Google Sheets tabs.
//   push: DB -> Sheet (overwrite tab)
//   pull: Sheet -> DB (upsert by key; mirror = delete DB rows missing from sheet)
import { Partner, Tier } from "@prisma/client";
import { prisma } from "./prisma";
import { canonicalSku } from "./sku";
import { writeTab, readTab } from "./sheets";
import { buildParTemplateRows } from "./par";
import { applyParUpload } from "./par";

export type SyncTable = "items" | "stores" | "pars";
export const SYNC_TABLES: { key: SyncTable; tab: string; label: string }[] = [
  { key: "items", tab: "Items", label: "Items (SKU master)" },
  { key: "stores", tab: "Stores", label: "Stores" },
  { key: "pars", tab: "Pars", label: "Pars (targets)" },
];

export interface PushResult {
  rows: number;
}
export interface PullResult {
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  warnings: string[];
}

const bool = (v: unknown) => (v ? "TRUE" : "FALSE");
const parseBool = (v: unknown) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
};

// ---------------- Items ----------------
const ITEM_HEADER = ["HK SKU", "Name", "Category", "MRP", "ERPNext Code", "CZ SKU", "Rebel SKU", "Active"];

async function pushItems(): Promise<PushResult> {
  const items = await prisma.item.findMany({ orderBy: { name: "asc" }, include: { partnerSkus: true } });
  const rows: (string | number)[][] = [ITEM_HEADER];
  for (const it of items) {
    const sku = (p: Partner) => it.partnerSkus.find((s) => s.partner === p)?.skuCode ?? "";
    rows.push([
      sku(Partner.HK),
      it.name,
      it.category ?? "",
      it.mrp ?? "",
      it.erpnextCode ?? "",
      sku(Partner.CZ),
      sku(Partner.REBEL),
      bool(it.active),
    ]);
  }
  await writeTab("Items", rows);
  return { rows: items.length };
}

async function pullItems(mirror: boolean): Promise<PullResult> {
  const aoa = await readTab("Items");
  const res: PullResult = { created: 0, updated: 0, deleted: 0, skipped: 0, warnings: [] };
  if (aoa.length < 2) {
    res.warnings.push("Items tab is empty — skipped.");
    return res;
  }
  const seenHk = new Set<string>();
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    const hk = canonicalSku(r[0]);
    if (!hk) { res.skipped++; continue; }
    seenHk.add(hk);
    const data = {
      name: String(r[1] ?? "").trim() || `SKU ${hk}`,
      category: String(r[2] ?? "").trim() || null,
      mrp: r[3] !== undefined && String(r[3]).trim() !== "" ? Number(r[3]) : null,
      erpnextCode: String(r[4] ?? "").trim() || null,
      active: r[7] !== undefined ? parseBool(r[7]) : true,
    };
    const existing = await prisma.itemPartnerSku.findUnique({
      where: { partner_skuCode: { partner: Partner.HK, skuCode: hk } },
    });
    let itemId: string;
    if (existing) {
      await prisma.item.update({ where: { id: existing.itemId }, data });
      itemId = existing.itemId;
      res.updated++;
    } else {
      const created = await prisma.item.create({
        data: { ...data, partnerSkus: { create: { partner: Partner.HK, skuCode: hk } } },
      });
      itemId = created.id;
      res.created++;
    }
    // CZ / Rebel partner skus from columns 5,6
    await upsertPartnerSku(itemId, Partner.CZ, canonicalSku(r[5]), res);
    await upsertPartnerSku(itemId, Partner.REBEL, canonicalSku(r[6]), res);
  }
  if (mirror) {
    const toDelete = await prisma.itemPartnerSku.findMany({
      where: { partner: Partner.HK, skuCode: { notIn: [...seenHk] } },
      select: { itemId: true },
    });
    if (toDelete.length) {
      await prisma.item.deleteMany({ where: { id: { in: toDelete.map((t) => t.itemId) } } });
      res.deleted += toDelete.length;
    }
  }
  return res;
}

async function upsertPartnerSku(itemId: string, partner: Partner, sku: string, res: PullResult) {
  try {
    if (!sku) {
      await prisma.itemPartnerSku.deleteMany({ where: { itemId, partner } });
      return;
    }
    await prisma.itemPartnerSku.upsert({
      where: { itemId_partner: { itemId, partner } },
      update: { skuCode: sku },
      create: { itemId, partner, skuCode: sku },
    });
  } catch {
    res.warnings.push(`${partner} SKU "${sku}" conflicts with another item — skipped.`);
  }
}

// ---------------- Stores ----------------
const STORE_HEADER = ["Name", "Partner", "Tier", "Active", "ERPNext Warehouse", "Location Aliases"];

async function pushStores(): Promise<PushResult> {
  const stores = await prisma.store.findMany({ orderBy: [{ partner: "asc" }, { sortOrder: "asc" }] });
  const rows: (string | number)[][] = [STORE_HEADER];
  for (const s of stores) {
    rows.push([
      s.name,
      s.partner,
      s.tier,
      bool(s.active),
      s.erpnextWarehouseId ?? "",
      s.locationAliases.join("; "),
    ]);
  }
  await writeTab("Stores", rows);
  return { rows: stores.length };
}

async function pullStores(mirror: boolean): Promise<PullResult> {
  const aoa = await readTab("Stores");
  const res: PullResult = { created: 0, updated: 0, deleted: 0, skipped: 0, warnings: [] };
  if (aoa.length < 2) {
    res.warnings.push("Stores tab is empty — skipped.");
    return res;
  }
  const seenKeys: { warehouse: string; name: string }[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    const name = String(r[0] ?? "").trim();
    if (!name) { res.skipped++; continue; }
    const partner = String(r[1] ?? "").trim().toUpperCase();
    const tier = String(r[2] ?? "").trim().toUpperCase();
    if (!(partner in Partner)) { res.warnings.push(`Store "${name}": bad partner "${partner}" — skipped.`); res.skipped++; continue; }
    if (!(tier in Tier)) { res.warnings.push(`Store "${name}": bad tier "${tier}" — skipped.`); res.skipped++; continue; }
    const warehouse = String(r[4] ?? "").trim();
    const aliases = String(r[5] ?? "").split(";").map((a) => a.trim()).filter(Boolean);
    seenKeys.push({ warehouse, name });

    const data = {
      name,
      partner: partner as Partner,
      tier: tier as Tier,
      active: r[3] !== undefined ? parseBool(r[3]) : true,
      erpnextWarehouseId: warehouse || null,
      locationAliases: aliases,
    };
    const existing = warehouse
      ? await prisma.store.findUnique({ where: { erpnextWarehouseId: warehouse } })
      : await prisma.store.findFirst({ where: { name } });
    if (existing) {
      await prisma.store.update({ where: { id: existing.id }, data });
      res.updated++;
    } else {
      await prisma.store.create({ data });
      res.created++;
    }
  }
  if (mirror) {
    const all = await prisma.store.findMany();
    const keep = new Set(seenKeys.flatMap((k) => [k.warehouse, k.name].filter(Boolean)));
    const del = all.filter((s) => !keep.has(s.erpnextWarehouseId ?? "") && !keep.has(s.name));
    if (del.length) {
      await prisma.store.deleteMany({ where: { id: { in: del.map((s) => s.id) } } });
      res.deleted += del.length;
    }
  }
  return res;
}

// ---------------- Pars ----------------
async function pushPars(): Promise<PushResult> {
  const rows = await buildParTemplateRows();
  await writeTab("Pars", rows);
  return { rows: rows.length - 1 };
}

async function pullPars(): Promise<PullResult> {
  const aoa = await readTab("Pars");
  const res: PullResult = { created: 0, updated: 0, deleted: 0, skipped: 0, warnings: [] };
  if (aoa.length < 2) {
    res.warnings.push("Pars tab is empty — skipped.");
    return res;
  }
  const r = await applyParUpload(aoa);
  res.updated = r.overridesSet + r.inherited;
  if (r.itemsUnmatched.length) res.warnings.push(`${r.itemsUnmatched.length} unknown SKU(s) skipped.`);
  if (r.unknownColumns.length) res.warnings.push(`Unknown store columns: ${r.unknownColumns.join(", ")}.`);
  return res;
}

// ---------------- dispatch ----------------
export async function syncPush(table: SyncTable): Promise<PushResult> {
  if (table === "items") return pushItems();
  if (table === "stores") return pushStores();
  return pushPars();
}

export async function syncPull(table: SyncTable, mirror: boolean): Promise<PullResult> {
  if (table === "items") return pullItems(mirror);
  if (table === "stores") return pullStores(mirror);
  return pullPars();
}
