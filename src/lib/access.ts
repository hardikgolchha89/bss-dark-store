// Access rules — pure + edge-safe (no Prisma), shared by auth config and server code.
// Sign-in is open to any Google account; *access* is decided here.

import type { AccessStatus } from "@prisma/client";

const allowedEmails = (process.env.AUTH_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const allowedDomains = (process.env.AUTH_ALLOWED_DOMAIN ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// "Bootstrap" access: company-domain emails and the env allowlist are always in,
// with no admin approval needed. Everyone else must be APPROVED by an admin.
export function isBootstrapAllowed(email: string | null | undefined): boolean {
  const e = (email ?? "").toLowerCase();
  if (!e) return false;
  if (allowedDomains.some((d) => e.endsWith(`@${d}`))) return true;
  return allowedEmails.includes(e);
}

// Final gate: may this user actually use the app?
export function isApproved(user: { email: string | null; status: AccessStatus }): boolean {
  if (user.status === "BLOCKED") return false; // explicit block wins over everything
  if (isBootstrapAllowed(user.email)) return true;
  return user.status === "APPROVED";
}
