import { auth } from "@/auth";
import { prisma } from "./prisma";
import { isApproved } from "./access";

// Current user from the Google session. Returns the DB user (with role/status).
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

// Access state for the current request: is the signed-in user approved to use
// the app, still pending an admin's decision, or explicitly blocked?
export async function getAccess() {
  const user = await getCurrentUser();
  if (!user) return { user: null, approved: false, pending: false, blocked: false };
  const approved = isApproved(user);
  return {
    user,
    approved,
    blocked: user.status === "BLOCKED",
    pending: !approved && user.status !== "BLOCKED",
  };
}

// Guard for API routes / data actions: throws unless the caller is approved.
// Pages use the layout gate (redirect to the pending screen) instead.
export async function assertApproved(): Promise<void> {
  const { approved } = await getAccess();
  if (!approved) throw new Error("Access not approved");
}
