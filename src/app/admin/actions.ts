"use server";

import { revalidatePath } from "next/cache";
import { AccessStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/current-user";

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

// ---- Access requests (self-service approvals) -----------------------------

// Approve / block an external user who signed in and is waiting for access.
export async function setUserAccess(userId: string, status: AccessStatus) {
  if (!(await isAdmin())) throw new Error("Admins only");
  await prisma.user.update({ where: { id: userId }, data: { status } });
  revalidatePath("/admin");
}

// Promote to admin / demote to member. Guard against an admin removing their
// own admin rights (which would lock them out of this screen).
export async function setUserRole(userId: string, role: Role) {
  const me = await getCurrentUser();
  if (me?.role !== "ADMIN") throw new Error("Admins only");
  if (me.id === userId && role !== "ADMIN") throw new Error("You can't remove your own admin access.");
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin");
}
