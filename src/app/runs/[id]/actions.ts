"use server";

import { revalidatePath } from "next/cache";
import { RunStatus, StockSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePrimeBuffer } from "@/lib/prime-csv";
import { matchStoreToLocation } from "@/lib/store-match";
import {
  ConcurrencyError,
  finalizeRun,
  ingestStock,
  markReceived,
  recomputeStore,
  reopenProcurement,
  setAdjusted,
  setRunDayType,
} from "@/lib/run-engine";
import { isAdmin } from "@/lib/current-user";
import type { UploadOutcome } from "./types";

async function assertDraft(runId: string) {
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  if (run.status === RunStatus.FINALIZED) throw new Error("Run is finalized and locked.");
}

// Upload one or more Prime stock files. Auto-detects store from the Location
// column; an optional forceStoreId pins a single file to a store.
export async function uploadPrime(
  runId: string,
  formData: FormData,
): Promise<UploadOutcome[]> {
  await assertDraft(runId);
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const forceStoreId = String(formData.get("forceStoreId") ?? "") || null;
  const stores = await prisma.store.findMany({ where: { active: true } });

  const outcomes: UploadOutcome[] = [];
  for (const file of files) {
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const parsed = parsePrimeBuffer(buf);
      if (parsed.errors.length && parsed.rows.length === 0) {
        outcomes.push({ file: file.name, ok: false, message: parsed.errors[0] });
        continue;
      }
      const storeId = forceStoreId ?? matchStoreToLocation(parsed.locationRaw, stores);
      if (!storeId) {
        outcomes.push({
          file: file.name,
          ok: false,
          message: `Couldn't match a store from "${parsed.locationRaw || "no Location"}". Pick a store and retry.`,
        });
        continue;
      }
      const store = stores.find((s) => s.id === storeId)!;
      const res = await ingestStock(runId, storeId, store.partner, parsed.rows, StockSource.PRIME_CSV);
      outcomes.push({
        file: file.name,
        ok: true,
        message: `${store.name}: ${res.matched} matched, ${res.unmapped} unmapped${res.anomalies ? `, ${res.anomalies} negative` : ""}.`,
      });
    } catch (e) {
      outcomes.push({ file: file.name, ok: false, message: (e as Error).message });
    }
  }
  revalidatePath(`/runs/${runId}`);
  return outcomes;
}

// CZ manual stock entry: { itemId: qty } for one CZ store.
export async function saveCzStock(
  runId: string,
  storeId: string,
  entries: { itemId: string; liveQty: number }[],
) {
  await assertDraft(runId);
  for (const e of entries) {
    await prisma.runStock.upsert({
      where: { runId_storeId_itemId: { runId, storeId, itemId: e.itemId } },
      update: { liveQty: e.liveQty, source: StockSource.MANUAL },
      create: { runId, storeId, itemId: e.itemId, liveQty: e.liveQty, source: StockSource.MANUAL },
    });
  }
  await recomputeStore(runId, storeId);
  revalidatePath(`/runs/${runId}`);
}

export async function saveAdjusted(
  runId: string,
  reqId: string,
  qty: number,
  expectedUpdatedAt: string,
): Promise<{ ok: boolean; message?: string }> {
  await assertDraft(runId);
  try {
    await setAdjusted(reqId, qty, new Date(expectedUpdatedAt));
    revalidatePath(`/runs/${runId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof ConcurrencyError) return { ok: false, message: e.message };
    return { ok: false, message: (e as Error).message };
  }
}

export async function resolveUnmapped(runId: string, unmappedId: string, itemId: string) {
  await assertDraft(runId);
  const um = await prisma.unmappedSku.findUniqueOrThrow({ where: { id: unmappedId } });
  // create the partner-sku mapping so it's caught next time, then mark resolved
  await prisma.itemPartnerSku.upsert({
    where: { partner_skuCode: { partner: um.partner, skuCode: um.skuCode } },
    update: { itemId },
    create: { itemId, partner: um.partner, skuCode: um.skuCode },
  });
  await prisma.unmappedSku.update({ where: { id: unmappedId }, data: { resolvedItemId: itemId } });
  // fold its stock into the run now
  const store = await prisma.store.findFirst({ where: { partner: um.partner } });
  if (store && um.liveQty != null) {
    await ingestStock(runId, store.id, um.partner, [{ skuCode: um.skuCode, name: um.rawName ?? "", liveQty: um.liveQty }], StockSource.PRIME_CSV);
  }
  revalidatePath(`/runs/${runId}`);
}

// Remove a single requirement line (one item at one store) from the order.
export async function removeRequirementLine(runId: string, reqId: string) {
  await assertDraft(runId);
  await prisma.runRequirement.update({ where: { id: reqId }, data: { removed: true } });
  revalidatePath(`/runs/${runId}`);
}

// Remove an item from the whole order (every store) — used from the consolidated preview.
export async function removeItemFromOrder(runId: string, itemId: string) {
  await assertDraft(runId);
  await prisma.runRequirement.updateMany({ where: { runId, itemId }, data: { removed: true } });
  revalidatePath(`/runs/${runId}`);
}

export async function ignoreUnmapped(runId: string, unmappedId: string) {
  await assertDraft(runId);
  await prisma.unmappedSku.update({ where: { id: unmappedId }, data: { ignored: true } });
  revalidatePath(`/runs/${runId}`);
}

export async function ignoreAllUnmapped(runId: string) {
  await assertDraft(runId);
  await prisma.unmappedSku.updateMany({
    where: { runId, resolvedItemId: null, ignored: false },
    data: { ignored: true },
  });
  revalidatePath(`/runs/${runId}`);
}

export async function receiveAndUnlock(runId: string): Promise<{ ok: boolean; message?: string }> {
  await assertDraft(runId);
  if (!(await isAdmin())) return { ok: false, message: "Admins only." };
  try {
    await markReceived(runId);
    revalidatePath(`/runs/${runId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function reopenToProcurement(runId: string): Promise<{ ok: boolean; message?: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Admins only." };
  try {
    await reopenProcurement(runId);
    revalidatePath(`/runs/${runId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function changeDayType(
  runId: string,
  dayType: "NORMAL" | "WEEKEND" | "PEAK",
): Promise<{ ok: boolean; message?: string }> {
  await assertDraft(runId);
  try {
    await setRunDayType(runId, dayType);
    revalidatePath(`/runs/${runId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function finalize(runId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await finalizeRun(runId);
    revalidatePath(`/runs/${runId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
