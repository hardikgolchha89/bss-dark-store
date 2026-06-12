import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge middleware: redirects unauthenticated users to /signin (via authorized callback).
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  // Protect everything except the auth API, the sign-in page, and static assets.
  matcher: ["/((?!api/auth|signin|_next/static|_next/image|favicon.ico).*)"],
};
