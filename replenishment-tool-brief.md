# Build Brief: Dark Store Replenishment Tool (HK / CakeZone / Rebel)

## Who & why
Bombay Sweet Shop (BSS) replenishes ~20 partner-run dark stores daily. Today this runs on a fragile Google Sheets workbook ("Hyperkytchens CakeZone Product Availability"): the team downloads stock CSVs from the partner's POS (Prime) store-by-store, pastes into per-store tabs, formulas roll up to a requirement, and POs are assembled by hand. We are replacing the workbook with a small web app used by 3–5 internal users (Hardik, Nisha, Yash + ops). Sheets remains only as a read-only published view of the item master.

## Hard constraints
- NOT Google Apps Script, NOT built on Sheets. Standalone web app with its own DB.
- Must SYNC the item master TO a Google Sheet (one-way push, on change or daily) so the team keeps their familiar live item list. Google Sheets API service account is fine.
- 3 partner SKU systems for the same item: HK Prime SKU, CZ Prime SKU, Rebel SKU — plus ERPNext item code. The app's internal item ID maps to all four.
- Auth: simple — email login or shared password is fine, this is internal.

## Stores
- ~17 HK stores (Hyperkytchens): Gamdevi, Malad, Juhu, Marol, Chembur, Powai, Kandivali, Goregaon, BKC, Dahisar, Vashi, Vasant Vihar, Thane Hiranandani, Mira Road, Sion, Oshiwara, Marine Lines (current set, must be configurable — stores get added).
- 3 CZ stores: Matunga, Mulund, Kharghar. CZ does not maintain Prime stock; their stock is manually entered (treat as low-trust).
- 2 Rebel stores (new vendor, own SKU codes).
- Store attributes: name, partner (HK/CZ/Rebel), tier (A/B/C), active flag.

## Core modules

### 1. SKU Master
- Fields: internal id, item name, category, MRP, unit (pcs), active flag, HK SKU, CZ SKU, Rebel SKU, ERPNext item code.
- CSV import to seed (from the existing Active Product List tab, ~1,000 items).
- One-way sync to a Google Sheet tab (the live product list the team eyeballs).
- Unmapped SKUs encountered anywhere surface here as fix tasks.

### 2. Par Manager
- Par qty per item × store. Tier templates: define par by tier (A/B/C) once; stores inherit; per-item-per-store overrides allowed. Day-type multipliers (normal / weekend / festive-peak) as a v1.1 — table normal pars now, keep schema ready.
- Bulk paste/CSV upload of pars (team currently maintains a ~800-row par sheet).

### 3. Daily Run
- Date-stamped run. For each HK store: drag-drop Prime CSV export (columns include Id, Location, Product, Category, **Sku**, Unit, **Unit Count** = live stock; key on Sku → Unit Count). Multi-file drop, file→store auto-detect from Location with manual override.
- CZ stores: editable grid for manual stock entry.
- Live validation panel: stores with no upload yet, unmapped SKUs, zero/negative anomalies, stale file detection (date in file ≠ run date).

### 4. Requirement
- Requirement per item per store = max(Par − Live, 0). (Old sheet used sqrt(par−live)^2 — abs() bug; do NOT replicate.)
- "Suggested" column (computed) + "Adjusted" column (editable, prefilled with Suggested) — adjusted value is what exports.
- Views: by store, by item (totals across stores for kitchen production), category subtotals. Possible-revenue total (Σ adjusted × MRP) as header KPI.

### 5. Exports (per run)
- **Kytchens PO** — xlsx per store, exact columns: SKU, Name, Remarks, Unit, Ordered Unit Quantity, Unit Cost. SKU = HK SKU.
- **CZ PO** — same layout, SKU = CZ SKU.
- **Rebel PO** — same layout, SKU = Rebel SKU (separate file per store).
- **ERPNext CSV** — container open: one CSV of all stores (store, ERPNext item code, qty) shaped for the bulk material-transfer upload ERP team is building. Format TBD, isolate in one adapter file.
- Consolidated total per item (for sorting/printout — replaces "Order Sheet for Printout").

## Nice-to-have later (do not build now)
Prime API pull, direct ERPNext push, fill-rate history, photo proof, login per partner so partners enter their own stock.

## Stack suggestion
Anything boring: Next.js/React + SQLite/Postgres, file parsing server-side, exports via SheetJS. Google Sheets sync = service account writing a single tab.

## Done = team runs one full day without opening the old workbook.

---

## Resolved decisions (grill session, 2026-06-05)

1. **Hosting/stack** — Cloud: Next.js on Vercel + Postgres (Neon). Shared, backed-up, server-side parsing & Sheets sync.
2. **Auth** — Email allowlist + magic link (NextAuth). Gives per-user attribution for the run audit trail.
3. **SKU mapping model** — CZ/Rebel sell the *same products* as HK with different per-partner codes. Model = one internal item + `item_partner_skus(item_id, partner, sku_code)` + `erpnext_code` on item. Seed HK code now; fill CZ/Rebel/ERPNext as partners share them. Unmapped-SKU fix queue catches unknowns.
4. **Par seeding** — Derive store tiers (A/B/C) from existing par patterns (I'll propose tier assignments from the data for confirmation). Tier template par = common value among the tier's stores; only deviating stores get an override row. Resolution: `override(item,store) ?? tier_template(item, store.tier)`.
5. **Ingestion / staleness** — Prime export has no reliable date. Drop "date-in-file" stale check; stamp uploads with upload time and warn if a store wasn't re-uploaded today. Store auto-detect from the `Location` column (`"... - BKC"` → BKC), manual override.
6. **Prime caveats confirmed** — `Unit Weighted Cost` (=1.0) and `Unit Par Level` (=0) and `Category` (="#_# Bombay Sweet Shop") in Prime exports are junk; cost, par, and category all come from the app/master, keyed on `Sku`.
7. **PO Unit Cost** — Hardcode `1.0` placeholder (PO is a transfer doc, not an invoice). Real cost field deferred.
8. **Requirement formula** — `max(par − max(live, 0), 0)`. Negative live clamped to 0 (don't over-order); negatives flagged as anomalies in the validation panel. (Old `sqrt(par−live)^2` abs() bug NOT replicated.)
9. **Run lifecycle** — Multiple runs allowed per date; each run has its own Draft → Finalized state. Re-upload replaces a store's stock while Draft; Finalize locks the run and generates exports (frozen audit record).
10. **Google Sheets sync** — One-way item-master push to one tab, **fully manual ("Sync now" button), no cron, no on-change** (revised in eng review). Adapter no-ops until service-account JSON + target sheet ID are provided. The app's own SKU Master screen is the primary source of truth.
11. **MVP sequencing** — Phase 1 (day-one bar): HK end-to-end — SKU master, par manager w/ derived tiers, daily run (HK CSV upload + CZ manual grid), requirement w/ adjust, Kytchens + CZ PO exports, consolidated printout. Phase 2 fast-follow: Sheets sync, Rebel stores + export, ERPNext CSV adapter, unmapped-SKU queue polish.

### Defaults I'll assume unless told otherwise
- **ERPNext CSV** — Phase 2, isolated adapter; default shape `(store, erpnext_item_code, qty)` until ERP team confirms.
- **Units** — integer `pcs`, no case-pack rounding.
- **UI** — clean, functional, dense ops tables; light BSS accent (can apply the `bss-brand` skill later).

### Still needs you (not blocking Phase 1 build)
- Google service-account JSON + target spreadsheet ID (only for the manual Sheets sync button).
- Confirm proposed store tier (A/B/C) assignments once I derive them.
- CZ / Rebel / ERPNext codes as partners share them.

---

## Eng review decisions (2026-06-05)

- **Stack:** Next.js (App Router) + Postgres + Prisma + NextAuth (magic link via Resend) + SheetJS (xlsx) + googleapis. All Layer 1 / boring-by-default.
- **Run immutability:** Finalize freezes `par_used`, `live_used`, `suggested`, `adjusted` into `RunRequirement`. Drafts compute par live; finalized runs are immutable audit records.
- **Sheets sync:** manual button only, no cron/on-change (see #10).
- **Unmapped SKUs:** warn loudly + one-click map, allow finalize; unmapped list saved with the run.
- **`sku_code` is a STRING**, canonicalized at every import/parse boundary (`"16223.0"` → `"16223"`).
- **Store↔CSV match:** `Store.location_aliases[]` matched against the Prime `Location` column; no match → manual store picker per file.
- **Exports:** one parameterized `buildPO(run, partner)` for all three PO types (differ only by which `sku_code`); ERPNext CSV is a separate isolated adapter (Phase 2).
- **Concurrency:** optimistic concurrency (row `updated_at`) on adjusted-qty edits + "someone else changed this" toast (multiple users per draft run).
- **Performance:** bulk-load pars/stock into maps once per run, single-pass compute (no per-cell DB round-trip).

### Data model
Item, ItemPartnerSku(partner, sku_code), Store(partner, tier, location_aliases[]), ParTemplate(item,tier,qty), ParOverride(item,store,qty), Run(run_date,label,status), RunStock(run,store,item,live,source), RunRequirement(run,store,item,par_used,live_used,suggested,adjusted — frozen), UnmappedSku(run,partner,sku_code,raw_name,resolved_item_id?).

### Open impl decision (decide during build, must be tested)
- Duplicate `Sku` rows within a single Prime file: sum vs last-wins. Default recommendation: **sum** (Prime sometimes splits a SKU across rows), but verify against a real export.

### Critical gap to handle
- Concurrent edits to the same draft run by 2+ users → optimistic concurrency + conflict toast.

---

## ERP integration + admin (added 2026-06-05, now in Phase 1)

Two ERPNext templates supplied: `Warehouse Data Export (1).csv` (warehouse master) and `Item upload template for stock entry.xlsx` (Stock Entry / Material Transfer bulk format).

- **ERPNext export = Stock Entry (Material Transfer)** in the exact template layout:
  `barcode | has_item_scanned | s_warehouse | t_warehouse | item_code | qty | uom | stock_uom | conversion_factor`.
  - `s_warehouse` = **`Andheri Dark Store Ops  - HIHPL`** always (note the double space — match ERPNext literally). Stored as admin Setting `erpnext_source_warehouse`, defaulted to this.
  - `t_warehouse` = `Store.erpnext_warehouse_id` (the store's warehouse, e.g. `HK- BKC - HIHPL`).
  - `item_code` = `Item.erpnext_code`. Lines for items without an erpnext_code are excluded + flagged.
  - `qty` = adjusted requirement. `uom`=`Nos`, `stock_uom`=`Nos`, `conversion_factor`=`1`, `barcode`/`has_item_scanned` blank.
  - One consolidated file across all stores (per the brief).
  - **Now Phase 1** (format is concrete, no longer TBD).
- **`Store.erpnext_warehouse_id`** added. Seed the store list from the warehouse export (HK Outlet / Dark Stores / Rebel children). Reconcile against par/live store names via `location_aliases`; mismatches (e.g. Live Stock has **Powai** with no HK warehouse; ERP has **Vikhroli / Andheri West** absent from stock tabs) are admin-resolved, surfaced like unmapped SKUs.
- **Admin profile** (`User.role` = admin | member). Admin-only area:
  - Assign each store's **tier (A/B/C)** on the fly + edit tier par templates; saved globally for all users.
  - **Feature flags** (DB `Setting` table, toggled live, apply to everyone): `erpnext_export_enabled`, `rebel_export_enabled`, `cz_export_enabled`, `block_finalize_on_unmapped`, `show_possible_revenue_kpi`, `sheets_sync_enabled`.
  - Settings values: `erpnext_source_warehouse` (default above).
  - Members run daily ops (runs, uploads, adjust, export) but cannot change config.

## Procurement stage (added 2026-06-09) — two-phase runs

Ops procure the consolidated total BEFORE dividing into stores. A run now has two phases:

- **Procurement**: upload all stores' stock → consolidated total per item → split **by category** into **3 source places** → raise a **Material Request** to each → goods received → "Mark received".
  - 3 places (ERPNext warehouses): `Byculla Mithai Packing (Ops) - HIHPL`, `Andheri Packaging Warehouse - HIHPL`, `Andheri Retail Warehouse - HIHPL`.
  - Category→place routing is admin-managed (Admin → Category routing). Unmapped categories are flagged and excluded from MRs.
  - MR export format is **PROVISIONAL** (`item_code,item_name,qty,uom,warehouse,material_request_type,schedule_date`, type=Material Transfer) — isolated in `buildMaterialRequestExport`; swap for the real ERPNext Material Request import template once the sample lands in `data/`.
- **Distribution** (gated until received): per-store grid + Kytchens/CZ/Rebel PO + ERPNext stock-entry exports (the original flow). Admin can reopen procurement.
- Schema: `RunPhase{PROCUREMENT,DISTRIBUTION}` + `Run.phase` + `Run.receivedAt`; `MaterialSource(name, erpnextWarehouseId)`; `CategorySource(category → source)`.

### Revised data model additions
- `Item.erpnext_code` (already present, nullable).
- `Store.erpnext_warehouse_id` (string, the ERPNext warehouse `name`).
- `User(email, role)`.
- `Setting(key, value)` — feature flags + config values, admin-editable.
