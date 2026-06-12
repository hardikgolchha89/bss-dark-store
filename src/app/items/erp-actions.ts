"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { isAdmin } from "@/lib/current-user";
import { applyErpCodeMapping } from "@/lib/erp-codes";

// Bulk import ERP item codes from the "HK SKU → ERP Item mapping" file
// (.csv or .xlsx). Keyed by HK SKU, writes item.erpnextCode.
export async function uploadErpCodes(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Admins only." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "No file." };
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer", raw: true });
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
    const r = await applyErpCodeMapping(aoa);
    revalidatePath("/items");
    if (r.warnings.length) return { ok: false, message: r.warnings.join(" ") };
    return {
      ok: true,
      message: `${r.updated} ERP codes set · ${r.unmatchedSkus} SKUs not in catalog · ${r.blankCodes} rows had no code.`,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
