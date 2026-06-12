"use client";

import { useState, useTransition } from "react";
import { ignoreAllUnmapped, ignoreUnmapped, resolveUnmapped } from "./actions";

interface Unmapped {
  id: string;
  skuCode: string;
  partner: string;
  rawName: string;
  resolvedItemId: string | null;
}

export default function UnmappedPanel({
  runId,
  isFinal,
  items,
  unmapped,
}: {
  runId: string;
  isFinal: boolean;
  items: { id: string; name: string }[];
  unmapped: Unmapped[];
}) {
  const [pending, start] = useTransition();
  const [picks, setPicks] = useState<Record<string, string>>({});

  const unresolved = unmapped.filter((u) => !u.resolvedItemId).length;

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-amber-800">Unmapped SKUs ({unresolved} unresolved)</h2>
        {!isFinal && unresolved > 0 && (
          <button
            disabled={pending}
            onClick={() => start(async () => { await ignoreAllUnmapped(runId); })}
            className="rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            Ignore all unresolved
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-amber-700">
        These SKUs were in an upload but don&apos;t match a known item for that partner. Map each to an item
        (saved so it&apos;s caught next time), or ignore ones you don&apos;t stock through this tool.
      </p>
      <table className="w-full text-sm">
        <thead className="text-left text-amber-700">
          <tr>
            <th className="py-1 font-medium">SKU</th>
            <th className="py-1 font-medium">Partner</th>
            <th className="py-1 font-medium">Name in file</th>
            <th className="py-1 font-medium">Map to item</th>
          </tr>
        </thead>
        <tbody>
          {unmapped.map((u) => (
            <tr key={u.id} className="border-t border-amber-200">
              <td className="py-1.5 tabular-nums">{u.skuCode}</td>
              <td className="py-1.5">{u.partner}</td>
              <td className="py-1.5 text-neutral-600">{u.rawName || "—"}</td>
              <td className="py-1.5">
                {u.resolvedItemId ? (
                  <span className="text-green-700">✓ mapped</span>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={picks[u.id] ?? ""}
                      onChange={(e) => setPicks((p) => ({ ...p, [u.id]: e.target.value }))}
                      disabled={isFinal}
                      className="rounded border border-neutral-300 px-2 py-1 text-sm"
                    >
                      <option value="">Select item…</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={pending || isFinal || !picks[u.id]}
                      onClick={() =>
                        start(async () => {
                          await resolveUnmapped(runId, u.id, picks[u.id]);
                        })
                      }
                      className="rounded bg-amber-700 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      Map
                    </button>
                    <button
                      disabled={pending || isFinal}
                      onClick={() => start(async () => { await ignoreUnmapped(runId, u.id); })}
                      className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Ignore
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
