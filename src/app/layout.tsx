import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BSS Darkstore Replenishment",
  description: "Daily dark-store stock checks, requirements, and partner POs.",
};

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
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              BSS Darkstore
            </Link>
            <nav className="flex gap-4 text-sm text-neutral-600">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-neutral-900">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
