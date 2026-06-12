"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/current-user";

// Delete a run (cascades to its stock/requirements/unmapped). Finalized runs are
// the audit record, so only an admin may delete those.
export async function deleteRun(runId: string): Promise<{ ok: boolean; message?: string }> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) return { ok: false, message: "Run not found." };
  if (run.status === "FINALIZED" && !(await isAdmin())) {
    return { ok: false, message: "Finalized runs can only be deleted by an admin." };
  }
  await prisma.run.delete({ where: { id: runId } });
  revalidatePath("/");
  return { ok: true };
}
