"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/current-user";
import { sheetsConfigured } from "@/lib/sheets";
import { syncPull, syncPush, type SyncTable } from "@/lib/sheet-sync";

export async function checkSheets() {
  return sheetsConfigured();
}

export async function pushToSheet(table: SyncTable): Promise<{ ok: boolean; message: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Admins only." };
  try {
    const r = await syncPush(table);
    return { ok: true, message: `Pushed ${r.rows} row(s) to the ${table} tab.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function pullFromSheet(
  table: SyncTable,
  mirror: boolean,
): Promise<{ ok: boolean; message: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Admins only." };
  try {
    const r = await syncPull(table, mirror);
    revalidatePath("/items");
    revalidatePath("/stores");
    revalidatePath("/pars");
    const parts = [`+${r.created} new`, `${r.updated} updated`];
    if (r.deleted) parts.push(`${r.deleted} deleted`);
    if (r.skipped) parts.push(`${r.skipped} skipped`);
    const msg = `Pulled ${table}: ${parts.join(", ")}.` + (r.warnings.length ? ` ⚠ ${r.warnings.join(" ")}` : "");
    return { ok: true, message: msg };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
