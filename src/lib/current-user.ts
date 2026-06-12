import { prisma } from "./prisma";

// AUTH DISABLED FOR DEMO: no login gate. "Current user" is the first admin so the
// whole app (incl. admin controls) is usable open. To re-enable Google OAuth:
//   1. restore src/middleware.ts (see git history),
//   2. swap this back to read the session via `auth()` from "@/auth",
//   3. restore <UserMenu/> in layout.
export async function getCurrentUser() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  return admin ?? (await prisma.user.findFirst());
}

export async function isAdmin(): Promise<boolean> {
  const u = await getCurrentUser();
  return u?.role === "ADMIN";
}
