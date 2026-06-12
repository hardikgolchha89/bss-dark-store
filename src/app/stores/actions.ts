"use server";

import { revalidatePath } from "next/cache";
import { Tier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/current-user";

export async function updateStoreTier(storeId: string, tier: Tier) {
  if (!(await isAdmin())) throw new Error("Admins only");
  await prisma.store.update({ where: { id: storeId }, data: { tier } });
  revalidatePath("/stores");
}

export async function toggleStoreActive(storeId: string, active: boolean) {
  if (!(await isAdmin())) throw new Error("Admins only");
  await prisma.store.update({ where: { id: storeId }, data: { active } });
  revalidatePath("/stores");
}
