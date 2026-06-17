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

// Create a new catalog item (+ its HK partner SKU, the natural key from Prime).
export async function createItem(data: {
  name: string;
  category?: string;
  hkSku: string;
  mrp?: number | null;
  erpnextCode?: string | null;
  fulfillmentSourceId?: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Admins only" };
  const name = data.name.trim();
  const hkSku = data.hkSku.trim();
  if (!name) return { ok: false, message: "Name is required." };
  if (!hkSku) return { ok: false, message: "HK SKU is required." };

  const clash = await prisma.itemPartnerSku.findUnique({
    where: { partner_skuCode: { partner: "HK", skuCode: hkSku } },
    include: { item: true },
  });
  if (clash) return { ok: false, message: `HK SKU ${hkSku} already maps to "${clash.item.name}".` };

  await prisma.item.create({
    data: {
      name,
      category: data.category?.trim() || null,
      mrp: data.mrp ?? null,
      erpnextCode: data.erpnextCode?.trim() || null,
      fulfillmentSourceId: data.fulfillmentSourceId || null,
      partnerSkus: { create: { partner: "HK", skuCode: hkSku } },
    },
  });
  revalidatePath("/items");
  return { ok: true };
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
