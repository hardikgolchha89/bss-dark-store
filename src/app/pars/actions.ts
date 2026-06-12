"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/current-user";
import { applyParUpload, type ParUploadResult } from "@/lib/par";

export async function uploadPars(
  formData: FormData,
): Promise<{ ok: boolean; message: string; result?: ParUploadResult }> {
  if (!(await isAdmin())) return { ok: false, message: "Admins only." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "No file." };

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer", raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    const result = await applyParUpload(aoa);

    // refresh any DRAFT runs so the new pars flow through immediately
    const draftRuns = await prisma.run.findMany({ where: { status: "DRAFT" }, select: { id: true } });
    if (draftRuns.length) {
      const { recomputeAll } = await import("@/lib/run-engine");
      for (const r of draftRuns) await recomputeAll(r.id);
    }

    revalidatePath("/pars");
    const parts = [
      `${result.itemsMatched} items updated`,
      `${result.overridesSet} overrides set`,
      `${result.inherited} inherited (matched tier default)`,
    ];
    if (result.itemsUnmatched.length) parts.push(`${result.itemsUnmatched.length} unknown SKUs skipped`);
    if (result.unknownColumns.length) parts.push(`unknown store columns: ${result.unknownColumns.join(", ")}`);
    return { ok: true, message: parts.join(" · "), result };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
