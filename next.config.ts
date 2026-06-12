import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile lives in the home dir).
  turbopack: {
    root: path.join(__dirname),
  },
  // SheetJS is server-only; keep it out of the client bundle.
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
