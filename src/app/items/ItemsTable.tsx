"use client";

import { useMemo, useState, useTransition } from "react";
import { setItemFulfillment, updateItem } from "./actions";

interface Item {
  id: string;
  name: string;
  category: string;
  hkSku: string;
  mrp: number | null;
  erpnextCode: string | null;
  fulfillmentSourceId: string | null;
}

export default function ItemsTable({
  items,
  sources,
  canEdit,
}: {
  items: Item[];
  sources: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [q, setQ] = useState("");
  const [, start] = useTransition();

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(t) ||
        i.hkSku.includes(t) ||
        i.category.toLowerCase().includes(t) ||
        (i.erpnextCode ?? "").toLowerCase().includes(t),
    );
  }, [q, items]);

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, SKU, category, ERPNext code…"
        className="w-full max-w-md rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">HK SKU</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">MRP</th>
              <th className="px-3 py-2 font-medium">ERPNext code</th>
              <th className="px-3 py-2 font-medium">Fulfillment location</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} className="border-t border-neutral-100">
                <td className="px-3 py-1.5 tabular-nums text-neutral-500">{i.hkSku}</td>
                <td className="px-3 py-1.5">{i.name}</td>
                <td className="px-3 py-1.5 text-neutral-500">{i.category}</td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={i.mrp ?? ""}
                    disabled={!canEdit}
                    onBlur={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      if (v !== i.mrp) start(() => updateItem(i.id, { mrp: v }));
                    }}
                    className="w-24 rounded border border-neutral-300 px-2 py-1 text-right tabular-nums disabled:bg-neutral-100"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    defaultValue={i.erpnextCode ?? ""}
                    disabled={!canEdit}
                    placeholder="—"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (i.erpnextCode ?? "")) start(() => updateItem(i.id, { erpnextCode: v }));
                    }}
                    className="w-40 rounded border border-neutral-300 px-2 py-1 disabled:bg-neutral-100"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <select
                    defaultValue={i.fulfillmentSourceId ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => start(() => setItemFulfillment(i.id, e.target.value))}
                    className={`rounded border px-2 py-1 text-sm disabled:bg-neutral-100 ${
                      i.fulfillmentSourceId ? "border-neutral-300" : "border-amber-300 bg-amber-50"
                    }`}
                  >
                    <option value="">— unassigned —</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-400">
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
