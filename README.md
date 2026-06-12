# BSS Darkstore Replenishment

Replaces the "Hyperkytchens CakeZone Product Availability" workbook. Daily dark-store
stock checks → requirements → partner POs + ERPNext stock entry.

Stack: Next.js (App Router) · Postgres + Prisma · SheetJS · Vitest. See
[`replenishment-tool-brief.md`](replenishment-tool-brief.md) for the full spec and the
decisions behind it.

## Setup (local)

```bash
# Postgres 14+ running locally
createdb bss_darkstore
cp .env.example .env          # then set DATABASE_URL, AUTH_SECRET, allowlist
npm install
npm run db:push               # create tables
npm run seed                  # load items/stores/pars from data/
npm run dev                   # http://localhost:3000
```

Seed reads the four files in `data/`:
- `Hyperkytchens CakeZone Product Availability.xlsx` — items (Active Product List) + pars (Par Count)
- `Warehouse Data Export (1).csv` — ERPNext warehouses → stores (HK/CZ/Rebel)
- `Item upload template for stock entry.xlsx` — ERPNext export format reference
- `Kytchens PO Format.xlsx` — PO layout reference

## Daily flow

1. **New run** (Runs page).
2. **Upload Prime stock** per store (.csv/.xlsx, multi-file). Store auto-detected from the
   file's `Location` column; override available.
3. **Validation panel** shows stores not uploaded, unmapped SKUs, negative stock.
4. **Requirement grid** — `suggested = max(par − max(live,0), 0)`. Edit Adjusted per line.
5. **Finalize** — freezes the numbers (immutable record).
6. **Export** — Kytchens PO (HK), CZ PO, ERPNext Stock Entry CSV, Consolidated printout.

Par resolution: `override(item,store) ?? tier_template(item, store.tier) ?? 0`.

## Admin

`/admin` — feature flags + settings (ERPNext source warehouse, export toggles, etc.),
applied globally. `/stores` — assign tiers, toggle active. `/items` — add MRP + ERPNext
codes (the ERPNext export only emits items with a code).

## Scripts

| Command | What |
|---|---|
| `npm run seed` | Load/refresh master data from `data/` (idempotent) |
| `npm test` | Unit tests (requirement math, SKU canon, parser, exports) |
| `npm run db:push` | Sync schema to DB |
| `npm run db:studio` | Prisma Studio |
| `node --env-file=.env --import tsx scripts/verify.ts` | End-to-end engine check on real BKC data |

## Status

Phase 1 (HK end-to-end) + procurement stage (consolidate → 3 Material Requests →
receive → per-store distribution) built and verified. Google OAuth (allowlist) gate
wired (needs Client ID/Secret). Deferred: CZ manual-entry grid UI, Rebel exports
(need codes), Google Sheets sync button.
