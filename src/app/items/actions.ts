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

// Create a new catalog item (+ its HK partner SKU, the natural key from Prime,
// and optionally a Rebel SKU = the Rebel inventory code).
export async function createItem(data: {
  name: string;
  category?: string;
  hkSku: string;
  rebelSku?: string | null;
  mrp?: number | null;
  erpnextCode?: string | null;
  fulfillmentSourceId?: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Admins only" };
  const name = data.name.trim();
  const hkSku = data.hkSku.trim();
  const rebelSku = data.rebelSku?.trim() || "";
  if (!name) return { ok: false, message: "Name is required." };
  if (!hkSku) return { ok: false, message: "HK SKU is required." };

  const hkClash = await prisma.itemPartnerSku.findUnique({
    where: { partner_skuCode: { partner: "HK", skuCode: hkSku } },
    include: { item: true },
  });
  if (hkClash) return { ok: false, message: `HK SKU ${hkSku} already maps to "${hkClash.item.name}".` };
  if (rebelSku) {
    const rClash = await prisma.itemPartnerSku.findUnique({
      where: { partner_skuCode: { partner: "REBEL", skuCode: rebelSku } },
      include: { item: true },
    });
    if (rClash) return { ok: false, message: `Rebel SKU ${rebelSku} already maps to "${rClash.item.name}".` };
  }

  const skus: { partner: "HK" | "REBEL"; skuCode: string }[] = [{ partner: "HK", skuCode: hkSku }];
  if (rebelSku) skus.push({ partner: "REBEL", skuCode: rebelSku });

  await prisma.item.create({
    data: {
      name,
      category: data.category?.trim() || null,
      mrp: data.mrp ?? null,
      erpnextCode: data.erpnextCode?.trim() || null,
      fulfillmentSourceId: data.fulfillmentSourceId || null,
      partnerSkus: { create: skus },
    },
  });
  revalidatePath("/items");
  return { ok: true };
}

// Set (or clear) an item's Rebel SKU = the Rebel inventory code on its PO.
export async function setItemRebelSku(itemId: string, sku: string): Promise<{ ok: boolean; message?: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Admins only" };
  const code = sku.trim();
  try {
    if (!code) {
      await prisma.itemPartnerSku.deleteMany({ where: { itemId, partner: "REBEL" } });
    } else {
      await prisma.itemPartnerSku.upsert({
        where: { itemId_partner: { itemId, partner: "REBEL" } },
        update: { skuCode: code },
        create: { itemId, partner: "REBEL", skuCode: code },
      });
    }
    revalidatePath("/items");
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message;
    return { ok: false, message: msg.includes("Unique") ? `Rebel SKU ${code} is already used by another item.` : msg };
  }
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
