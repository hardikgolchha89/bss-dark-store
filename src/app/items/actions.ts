"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/current-user";

export async function updateItem(
  itemId: string,
  data: { erpnextCode?: string | null; mrp?: number | null },
) {
  if (!(await isAdmin())) throw new Error("Admins only");
  await prisma.item.update({
    where: { id: itemId },
    data: {
      erpnextCode: data.erpnextCode === undefined ? undefined : data.erpnextCode || null,
      mrp: data.mrp === undefined ? undefined : data.mrp,
    },
  });
  revalidatePath("/items");
}

// Assign an item's fulfillment location (one of the 3 source places, or none).
export async function setItemFulfillment(itemId: string, sourceId: string) {
  if (!(await isAdmin())) throw new Error("Admins only");
  await prisma.item.update({
    where: { id: itemId },
    data: { fulfillmentSourceId: sourceId || null },
  });
  revalidatePath("/items");
}
