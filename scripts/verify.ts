/**
 * End-to-end verification of the run engine against real data.
 * Uses the real "BKC" per-store tab (which IS a Prime export) as the upload.
 */
import path from "node:path";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { PrismaClient, Partner, StockSource } from "@prisma/client";
import { parsePrimeBuffer } from "../src/lib/prime-csv";
import { matchStoreToLocation } from "../src/lib/store-match";
import {
  ingestStock,
  finalizeRun,
  buildPOExport,
  buildErpExport,
  buildConsolidatedExport,
  setAdjusted,
} from "../src/lib/run-engine";

const prisma = new PrismaClient();
const WB = path.join(process.cwd(), "data", "Hyperkytchens CakeZone Product Availability.xlsx");

async function main() {
  // 1. Extract the BKC tab into a standalone Prime-format buffer.
  const src = XLSX.readFile(WB);
  const single = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(single, src.Sheets["BKC"], "BKC");
  const buf = XLSX.write(single, { type: "buffer", bookType: "xlsx" }) as Buffer;

  // 2. Parse + auto-detect store.
  const parsed = parsePrimeBuffer(buf);
  const stores = await prisma.store.findMany({ where: { active: true } });
  const storeId = matchStoreToLocation(parsed.locationRaw, stores);
  const store = stores.find((s) => s.id === storeId);
  console.log(`Parsed BKC: location="${parsed.locationRaw}" rows=${parsed.rows.length}`);
  console.log(`Auto-detected store: ${store?.name ?? "NONE"} (${store?.partner})`);
  if (!store) throw new Error("store auto-detect failed");

  // 3. Create a run, ingest.
  const run = await prisma.run.create({ data: { runDate: new Date(), label: "verify" } });
  const res = await ingestStock(run.id, store.id, Partner.HK, parsed.rows, StockSource.PRIME_CSV);
  console.log(`Ingest: matched=${res.matched} unmapped=${res.unmapped} anomalies=${res.anomalies}`);

  // 4. Inspect a few requirement lines.
  const reqs = await prisma.runRequirement.findMany({
    where: { runId: run.id, storeId: store.id },
    include: { item: true },
    orderBy: { suggested: "desc" },
    take: 5,
  });
  console.log("Top 5 requirement lines (par / live / suggested):");
  for (const r of reqs) {
    console.log(`  ${r.item.name.slice(0, 32).padEnd(32)} par=${r.parUsed} live=${r.liveUsed} sugg=${r.suggested}`);
  }

  // 5. Edit one adjusted value (exercise concurrency path).
  if (reqs[0]) {
    await setAdjusted(reqs[0].id, reqs[0].suggested + 3, reqs[0].updatedAt);
    console.log(`Adjusted "${reqs[0].item.name.slice(0, 24)}" -> ${reqs[0].suggested + 3}`);
  }

  // 6. Give one item an ERPNext code so the ERP export emits a line.
  if (reqs[0]) {
    await prisma.item.update({ where: { id: reqs[0].itemId }, data: { erpnextCode: "VERIFY-ITEM-1" } });
  }

  // 7. Finalize + build all exports.
  await finalizeRun(run.id);
  const po = await buildPOExport(run.id, Partner.HK);
  const erp = await buildErpExport(run.id);
  const con = await buildConsolidatedExport(run.id);

  fs.mkdirSync("/tmp/bss-verify", { recursive: true });
  fs.writeFileSync(`/tmp/bss-verify/${po.filename}`, po.buffer);
  fs.writeFileSync(`/tmp/bss-verify/${erp.filename}`, erp.buffer);
  fs.writeFileSync(`/tmp/bss-verify/${con.filename}`, con.buffer);

  // 8. Read the PO back and show header + first line.
  const poWb = XLSX.read(po.buffer, { type: "buffer" });
  const poSheet = poWb.Sheets[poWb.SheetNames[0]];
  const poRows = XLSX.utils.sheet_to_json<unknown[]>(poSheet, { header: 1 });
  console.log(`\nPO file: ${po.filename} (sheet "${poWb.SheetNames[0]}")`);
  console.log("  header:", poRows[0]);
  console.log("  line 1:", poRows[1]);
  console.log(`\nERP file: ${erp.filename}`);
  console.log("  " + erp.buffer.toString("utf-8").split("\n").slice(0, 2).join("\n  "));
  console.log(`\nWrote exports to /tmp/bss-verify/`);

  // cleanup the verify run so it doesn't clutter the UI
  await prisma.run.delete({ where: { id: run.id } });
  console.log("Cleaned up verify run.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
