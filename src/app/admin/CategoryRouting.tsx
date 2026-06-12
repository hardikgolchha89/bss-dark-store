"use client";

import { useTransition } from "react";
import { setCategorySource } from "./actions";

export default function CategoryRouting({
  categories,
  sources,
  mapping,
  canEdit,
}: {
  categories: { name: string; itemCount: number }[];
  sources: { id: string; name: string }[];
  mapping: Record<string, string>; // category -> sourceId
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold">Category routing → source place</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Each item category is requested from one of the three places. Unmapped categories won&apos;t appear on any
        Material Request.
      </p>
      <div className="overflow-hidden rounded border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Items</th>
              <th className="px-3 py-2 font-medium">Source place</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const current = mapping[c.name] ?? "";
              return (
                <tr key={c.name} className="border-t border-neutral-100">
                  <td className="px-3 py-1.5">{c.name || <span className="text-neutral-400">(blank)</span>}</td>
                  <td className="px-3 py-1.5 text-right text-neutral-500">{c.itemCount}</td>
                  <td className="px-3 py-1.5">
                    <select
                      defaultValue={current}
                      disabled={!canEdit || pending}
                      onChange={(e) => start(() => setCategorySource(c.name, e.target.value))}
                      className={`rounded border px-2 py-1 text-sm disabled:bg-neutral-100 ${
                        current ? "border-neutral-300" : "border-amber-300 bg-amber-50"
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
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
