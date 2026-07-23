import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Prisma) — shared by middleware and the full auth instance.
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
    // Sign-in is OPEN to any Google account — new users land on the "pending"
    // screen and request access. Whether they can actually USE the app is
    // decided by isApproved() (see @/lib/access) at the page/API layer, which
    // needs the DB and can't run in this edge-shared config.
    signIn() {
      return true;
    },
    // Middleware uses this: must be signed in for every protected route.
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
