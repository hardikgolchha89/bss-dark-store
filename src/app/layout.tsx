import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import UserMenu from "./UserMenu";

export const metadata: Metadata = {
  title: "BSS Darkstore Replenishment",
  description: "Daily dark-store stock checks, requirements, and partner POs.",
};

export const viewport = { themeColor: "#faf8f5" };

const NAV = [
  { href: "/", label: "Runs" },
  { href: "/items", label: "Items" },
  { href: "/pars", label: "Pars" },
  { href: "/stores", label: "Stores" },
  { href: "/admin", label: "Admin" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream text-navy antialiased">
        <header className="border-b border-line bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/wordmark-color.png" alt="Bombay Sweet Shop" className="h-7 w-auto" />
              <span className="hidden font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted sm:inline">
                Darkstore Ops
              </span>
            </Link>
            <nav className="ml-auto flex gap-1 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-md px-3 py-1.5 font-medium text-ink-soft transition-colors hover:bg-teal/10 hover:text-teal-dark"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
