"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/current-user";

export async function saveSetting(key: string, value: string) {
  if (!(await isAdmin())) throw new Error("Admins only");
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

// Route an item category to one of the 3 source places (empty = unassigned).
export async function setCategorySource(category: string, sourceId: string) {
  if (!(await isAdmin())) throw new Error("Admins only");
  if (!sourceId) {
    await prisma.categorySource.deleteMany({ where: { category } });
  } else {
    await prisma.categorySource.upsert({
      where: { category },
      update: { sourceId },
      create: { category, sourceId },
    });
  }
  revalidatePath("/admin");
}
