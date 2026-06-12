import { auth } from "@/auth";
import { prisma } from "./prisma";

// Current user from the Google session. Returns the DB user (with role).
export async function getCurrentUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function isAdmin(): Promise<boolean> {
  const u = await getCurrentUser();
  return u?.role === "ADMIN";
}
