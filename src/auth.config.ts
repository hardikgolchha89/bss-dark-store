import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Prisma) — shared by middleware and the full auth instance.
const allowedEmails = (process.env.AUTH_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const allowedDomains = (process.env.AUTH_ALLOWED_DOMAIN ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowed(email: string | null | undefined): boolean {
  const e = (email ?? "").toLowerCase();
  if (!e) return false;
  if (allowedDomains.some((d) => e.endsWith(`@${d}`))) return true;
  return allowedEmails.includes(e);
}

export const authConfig = {
  providers: [
    Google({
      // Link Google sign-in to a pre-seeded user with the same email (single trusted provider).
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: { signIn: "/signin" },
  trustHost: true,
  callbacks: {
    // Allowlist gate: only approved emails/domain may sign in.
    signIn({ user }) {
      return isAllowed(user.email);
    },
    // Middleware uses this: signed-in users only, everywhere.
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
