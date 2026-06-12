"use client";

import { useMemo, useState, useTransition } from "react";
import { removeRequirementLine, saveAdjusted } from "./actions";

interface Row {
  id: string;
  storeId: string;
  storeName: string;
  itemName: string;
  category: string;
  par: number;
  live: number;
  suggested: number;
  adjusted: number;
  updatedAt: string;
}

export default function RequirementGrid({
  runId,
  rows,
  isFinal,
}: {
  runId: string;
  rows: Row[];
  isFinal: boolean;
}) {
  const stores = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.storeId)) seen.set(r.storeId, r.storeName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [versions, setVersions] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, start] = useTransition();

  const shown = rows.filter((r) => r.storeId === storeId);

  function save(row: Row, value: number) {
    setEdits((e) => ({ ...e, [row.id]: value }));
    const expected = versions[row.id] ?? row.updatedAt;
    start(async () => {
      const res = await saveAdjusted(runId, row.id, value, expected);
      if (!res.ok) {
        setErrors((e) => ({ ...e, [row.id]: res.message ?? "Save failed" }));
      } else {
        setErrors((e) => {
          const n = { ...e };
          delete n[row.id];
          return n;
        });
        setVersions((v) => ({ ...v, [row.id]: new Date().toISOString() }));
      }
    });
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-400">
        No requirement lines yet. Upload stock to populate.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-3">
        <h2 className="text-sm font-semibold">Requirement</h2>
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-100 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Par</th>
              <th className="px-3 py-2 text-right font-medium">Live</th>
              <th className="px-3 py-2 text-right font-medium">Suggested</th>
              <th className="px-3 py-2 text-right font-medium">Adjusted</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const val = edits[r.id] ?? r.adjusted;
              return (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="px-3 py-1.5">{r.itemName}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{r.category}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.par}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${r.live < 0 ? "text-red-600" : ""}`}>
                    {r.live}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">{r.suggested}</td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      min={0}
                      defaultValue={val}
                      disabled={isFinal}
                      onBlur={(e) => {
                        const n = Math.max(0, Math.round(Number(e.target.value)));
                        if (n !== r.adjusted) save(r, n);
                      }}
                      className={`w-20 rounded border px-2 py-1 text-right tabular-nums ${
                        errors[r.id] ? "border-red-400 bg-red-50" : "border-neutral-300"
                      } disabled:bg-neutral-100`}
                    />
                    {errors[r.id] && <div className="text-[10px] text-red-600">{errors[r.id]}</div>}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {!isFinal && (
                      <button
                        title="Remove this line from the order"
                        onClick={() => {
                          if (!confirm(`Remove "${r.itemName}" from ${r.storeName}'s order?`)) return;
                          start(async () => {
                            await removeRequirementLine(runId, r.id);
                          });
                        }}
                        className="rounded px-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
