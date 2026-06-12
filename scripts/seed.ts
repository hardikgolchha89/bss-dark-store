/**
 * Seed the replenishment DB from the source workbook + ERPNext exports in data/.
 *
 * Pipeline:
 *   1. Settings (feature flags + ERPNext source warehouse)
 *   2. Admin/member users from env allowlist
 *   3. Stores from the ERPNext Warehouse export (HK / CZ / Rebel children)
 *   4. Items + HK partner SKUs from "Active Product List"
 *   5. Pars from "Par Count": derive store tiers, tier templates, and overrides
 *
 * Idempotent: re-running upserts. Logs what mapped and what didn't (e.g. Powai
 * has a par column but no ERPNext warehouse, so its pars are reported + skipped).
 */
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient, Partner, Tier } from "@prisma/client";
import { canonicalSku, cleanProductName } from "../src/lib/sku";
import { SETTING_DEFS } from "../src/lib/settings";

const prisma = new PrismaClient();
const DATA = path.join(process.cwd(), "data");
const WB = path.join(DATA, "Hyperkytchens CakeZone Product Availability.xlsx");
const WAREHOUSES = path.join(DATA, "Warehouse Data Export (1).csv");

// --- helpers ---------------------------------------------------------------

// ERPNext CSV exports wrap values in literal double quotes inside the cell.
function unquote(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .trim();
}

function readSheet(file: string, sheet: string): unknown[][] {
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error(`sheet "${sheet}" not found in ${path.basename(file)}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
}

// Distinctive token for fuzzy store matching: drop partner prefixes, qualifiers,
// punctuation and spaces. "HK - Goregaon East" -> "goregaoneast".
function storeKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\bhihpl\b/g, "")
    .replace(/\b(hk|cz|rebel|cfi|foh|ops|warehouse|outlet)\b/g, "")
    .replace(/bombay sweet shop inventory/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function matchStore(parLabel: string, stores: { id: string; key: string }[]): string | null {
  const k = storeKey(parLabel);
  if (!k) return null;
  // exact, then containment (longest match wins to avoid weak partials)
  const exact = stores.find((s) => s.key === k);
  if (exact) return exact.id;
  const contains = stores
    .filter((s) => s.key.includes(k) || k.includes(s.key))
    .sort((a, b) => b.key.length - a.key.length);
  return contains[0]?.id ?? null;
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = -1;
  for (const [v, c] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

// --- 1. settings -----------------------------------------------------------

async function seedSettings() {
  for (const def of SETTING_DEFS) {
    await prisma.setting.upsert({
      where: { key: def.key },
      update: {}, // never clobber an admin's live value on re-seed
      create: { key: def.key, value: def.default },
    });
  }
  console.log(`  settings: ${SETTING_DEFS.length} ensured`);
}

// --- 2. users --------------------------------------------------------------

async function seedUsers() {
  const admins = (process.env.SEED_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const email of admins) {
    await prisma.user.upsert({
      where: { email },
      update: { role: "ADMIN" },
      create: { email, role: "ADMIN" },
    });
  }
  console.log(`  users: ${admins.length} admin(s) ensured`);
}

// --- 3. stores from ERPNext warehouse export -------------------------------

const PARENT_TO_PARTNER: Record<string, Partner> = {
  "HK Outlet - HIHPL": Partner.HK,
  "Dark Stores - HIHPL": Partner.CZ,
  "Rebel Warehouse - HIHPL": Partner.REBEL,
};

function displayStoreName(warehouseName: string): string {
  return warehouseName
    .replace(/^HK\s*-\s*/i, "")
    .replace(/^HK-\s*/i, "")
    .replace(/^CZ-\s*/i, "")
    .replace(/^REBEL\s*-\s*/i, "")
    .trim();
}

async function seedStores() {
  const wb = XLSX.readFile(WAREHOUSES, { raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  // Find the "Start entering data below this line" marker, then read rows.
  let start = rows.findIndex((r) => String(r?.[0] ?? "").includes("Start entering data"));
  start = start >= 0 ? start + 1 : 19;

  let created = 0;
  let sort = 0;
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const id = unquote(r?.[1]); // ERPNext warehouse ID (name)
    const warehouseName = unquote(r?.[2]);
    const isGroup = unquote(r?.[6]) === "1";
    const parent = unquote(r?.[7]);
    if (!id || isGroup) continue;
    const partner = PARENT_TO_PARTNER[parent];
    if (!partner) continue; // skip non-dark-store warehouses (kitchens, FOH, etc.)

    const name = displayStoreName(warehouseName);
    const alias = `Bombay Sweet Shop Inventory - ${name}`;
    await prisma.store.upsert({
      where: { erpnextWarehouseId: id },
      update: { name, partner, erpnextWarehouseId: id },
      create: {
        name,
        partner,
        erpnextWarehouseId: id,
        locationAliases: [alias],
        sortOrder: sort++,
      },
    });
    created++;
  }
  console.log(`  stores: ${created} dark-store warehouses (HK/CZ/Rebel)`);
}

// --- 3b. material sources (the 3 procurement places) ------------------------

const MATERIAL_SOURCES = [
  { name: "Byculla Mithai Packing", erpnextWarehouseId: "Byculla Mithai Packing (Ops) - HIHPL", sortOrder: 0 },
  { name: "Andheri Packaging Warehouse", erpnextWarehouseId: "Andheri Packaging Warehouse - HIHPL", sortOrder: 1 },
  { name: "Andheri Retail Warehouse", erpnextWarehouseId: "Andheri Retail Warehouse - HIHPL", sortOrder: 2 },
];

async function seedMaterialSources() {
  for (const s of MATERIAL_SOURCES) {
    const existing = await prisma.materialSource.findFirst({ where: { name: s.name } });
    if (existing) {
      await prisma.materialSource.update({ where: { id: existing.id }, data: s });
    } else {
      await prisma.materialSource.create({ data: s });
    }
  }
  console.log(`  material sources: ${MATERIAL_SOURCES.length} ensured`);
}

// --- 4. items + HK partner skus --------------------------------------------

async function seedItems() {
  const rows = readSheet(WB, "Active Product List");
  // header: Sku | Product | Category
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const sku = canonicalSku(r?.[0]);
    if (!sku) continue; // section header / blank row
    const name = cleanProductName(r?.[1]);
    const category = r?.[2] ? String(r[2]).trim() : null;
    if (!name) continue;

    // Upsert the item via its HK partner sku (the natural key from this list).
    const existing = await prisma.itemPartnerSku.findUnique({
      where: { partner_skuCode: { partner: Partner.HK, skuCode: sku } },
      include: { item: true },
    });
    if (existing) {
      await prisma.item.update({
        where: { id: existing.itemId },
        data: { name, category: category ?? undefined },
      });
    } else {
      await prisma.item.create({
        data: {
          name,
          category,
          partnerSkus: { create: { partner: Partner.HK, skuCode: sku } },
        },
      });
    }
    count++;
  }
  console.log(`  items: ${count} HK items ensured`);
}

// --- 5. pars: derive tiers, templates, overrides ---------------------------

async function seedPars() {
  const rows = readSheet(WB, "Par Count");
  const headerIdx = rows.findIndex((r) => String(r?.[0] ?? "").trim().toLowerCase() === "sku");
  if (headerIdx < 0) throw new Error("Par Count: no header row");
  const header = rows[headerIdx].map((c) => String(c ?? "").trim());
  const totalIdx = header.findIndex((h) => h.toLowerCase() === "total");
  const storeColStart = totalIdx >= 0 ? totalIdx + 1 : 3;

  const dbStores = await prisma.store.findMany();
  const storeKeys = dbStores.map((s) => ({ id: s.id, key: storeKey(s.name) }));

  // Map each par column -> store id
  const colToStore: { col: number; storeId: string | null; label: string }[] = [];
  for (let c = storeColStart; c < header.length; c++) {
    const label = header[c];
    if (!label) continue;
    colToStore.push({ col: c, label, storeId: matchStore(label, storeKeys) });
  }
  const unmatched = colToStore.filter((c) => !c.storeId).map((c) => c.label);
  if (unmatched.length) {
    console.log(`  ! par columns with no ERPNext warehouse (skipped): ${unmatched.join(", ")}`);
  }

  // Load item lookup by HK sku
  const hkSkus = await prisma.itemPartnerSku.findMany({ where: { partner: Partner.HK } });
  const skuToItem = new Map(hkSkus.map((s) => [s.skuCode, s.itemId]));

  // Gather par values: itemId -> storeId -> qty
  type ParRow = { itemId: string; perStore: Map<string, number> };
  const parRows: ParRow[] = [];
  const storeTotals = new Map<string, number>(); // for tier ranking

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const sku = canonicalSku(r?.[0]);
    if (!sku) continue;
    let itemId = skuToItem.get(sku);
    if (!itemId) {
      // par references an item not in the Active Product List — create it so pars survive
      const name = cleanProductName(r?.[1]) || `SKU ${sku}`;
      const category = r?.[2] ? String(r[2]).trim() : null;
      const item = await prisma.item.create({
        data: { name, category, partnerSkus: { create: { partner: Partner.HK, skuCode: sku } } },
      });
      itemId = item.id;
      skuToItem.set(sku, itemId);
    }
    const perStore = new Map<string, number>();
    for (const { col, storeId } of colToStore) {
      if (!storeId) continue;
      const v = r?.[col];
      if (v === null || v === undefined || v === "") continue;
      const qty = Math.round(Number(v));
      if (!Number.isFinite(qty)) continue;
      perStore.set(storeId, qty);
      storeTotals.set(storeId, (storeTotals.get(storeId) ?? 0) + qty);
    }
    if (perStore.size) parRows.push({ itemId, perStore });
  }

  // Derive tiers: rank stores that have par data by total par into terciles.
  const ranked = [...storeTotals.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const tierOf = new Map<string, Tier>();
  const third = Math.ceil(ranked.length / 3) || 1;
  ranked.forEach((id, idx) => {
    tierOf.set(id, idx < third ? Tier.A : idx < third * 2 ? Tier.B : Tier.C);
  });
  // Persist tier assignments (stores without par data keep default B).
  for (const [storeId, tier] of tierOf) {
    await prisma.store.update({ where: { id: storeId }, data: { tier } });
  }

  // For each item: tier template = mode of pars among that tier's stores; override where differs.
  let templates = 0;
  let overrides = 0;
  for (const { itemId, perStore } of parRows) {
    const byTier: Record<Tier, number[]> = { A: [], B: [], C: [] };
    for (const [storeId, qty] of perStore) {
      const t = tierOf.get(storeId);
      if (t) byTier[t].push(qty);
    }
    const tplValue: Partial<Record<Tier, number>> = {};
    for (const tier of [Tier.A, Tier.B, Tier.C]) {
      const vals = byTier[tier];
      if (!vals.length) continue;
      const m = mode(vals);
      tplValue[tier] = m;
      await prisma.parTemplate.upsert({
        where: { itemId_tier: { itemId, tier } },
        update: { qty: m },
        create: { itemId, tier, qty: m },
      });
      templates++;
    }
    // overrides where a store's par differs from its tier template
    for (const [storeId, qty] of perStore) {
      const t = tierOf.get(storeId);
      const tpl = t ? tplValue[t] : undefined;
      if (tpl === undefined || qty !== tpl) {
        await prisma.parOverride.upsert({
          where: { itemId_storeId: { itemId, storeId } },
          update: { qty },
          create: { itemId, storeId, qty },
        });
        overrides++;
      }
    }
  }

  const tierCounts = { A: 0, B: 0, C: 0 } as Record<Tier, number>;
  for (const t of tierOf.values()) tierCounts[t]++;
  console.log(
    `  pars: ${templates} tier templates, ${overrides} overrides | tiers A:${tierCounts.A} B:${tierCounts.B} C:${tierCounts.C}`,
  );
  // Show the proposed tier assignment for admin review.
  const storesById = new Map(dbStores.map((s) => [s.id, s.name]));
  const byTierNames: Record<string, string[]> = { A: [], B: [], C: [] };
  for (const [id, t] of tierOf) byTierNames[t].push(storesById.get(id) ?? id);
  console.log(`    A: ${byTierNames.A.join(", ")}`);
  console.log(`    B: ${byTierNames.B.join(", ")}`);
  console.log(`    C: ${byTierNames.C.join(", ")}`);
}

async function main() {
  console.log("Seeding BSS Darkstore…");
  await seedSettings();
  await seedUsers();
  await seedStores();
  await seedMaterialSources();
  await seedItems();
  await seedPars();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
