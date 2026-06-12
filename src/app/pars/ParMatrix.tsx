"use client";

import { useMemo, useState } from "react";

interface Store {
  id: string;
  name: string;
  partner: string;
  tier: string;
}
interface Row {
  itemId: string;
  sku: string;
  name: string;
  category: string;
  pars: number[];
}

export default function ParMatrix({ stores, rows }: { stores: Store[]; rows: Row[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(t) || r.sku.includes(t) || r.category.toLowerCase().includes(t),
    );
  }, [q, rows]);

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search item, SKU, category…"
        className="w-full max-w-md rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="overflow-auto rounded-lg border border-neutral-200 bg-white" style={{ maxHeight: "70vh" }}>
        <table className="text-sm">
          <thead className="sticky top-0 z-20 bg-neutral-100 text-neutral-500">
            <tr>
              <th className="sticky left-0 z-30 bg-neutral-100 px-3 py-2 text-left font-medium">Item</th>
              {stores.map((s) => (
                <th key={s.id} className="px-2 py-2 text-right font-medium whitespace-nowrap" title={`${s.partner} · tier ${s.tier}`}>
                  {s.name}
                  <span className="ml-1 text-[10px] text-neutral-400">{s.tier}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.itemId} className="border-t border-neutral-100">
                <td className="sticky left-0 z-10 max-w-[260px] truncate bg-white px-3 py-1.5" title={`${r.sku} · ${r.name}`}>
                  {r.name}
                </td>
                {r.pars.map((p, i) => (
                  <td
                    key={i}
                    className={`px-2 py-1.5 text-right tabular-nums ${p === 0 ? "text-neutral-300" : ""}`}
                  >
                    {p}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={stores.length + 1} className="px-3 py-6 text-center text-neutral-400">
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">
        Showing the effective par per item × store ({rows.length} items × {stores.length} stores). Tier shown under
        each store. To change: download the template, edit, and bulk-upload. Values matching the tier default inherit;
        others become per-store overrides.
      </p>
    </div>
  );
}
