"use client";

import { useTransition } from "react";
import { Tier } from "@prisma/client";
import { toggleStoreActive, updateStoreTier } from "./actions";

export default function StoreRow({
  store,
  canEdit,
}: {
  store: {
    id: string;
    name: string;
    partner: string;
    tier: Tier;
    active: boolean;
    erpnextWarehouseId: string | null;
    locationAliases: string[];
  };
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <tr className="border-t border-neutral-100">
      <td className="px-3 py-1.5 font-medium">{store.name}</td>
      <td className="px-3 py-1.5">{store.partner}</td>
      <td className="px-3 py-1.5">
        <select
          defaultValue={store.tier}
          disabled={!canEdit || pending}
          onChange={(e) => start(() => updateStoreTier(store.id, e.target.value as Tier))}
          className="rounded border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-100"
        >
          {(["A", "B", "C"] as Tier[]).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-1.5 text-xs text-neutral-500">{store.erpnextWarehouseId ?? "—"}</td>
      <td className="px-3 py-1.5 text-xs text-neutral-400">{store.locationAliases.join("; ") || "—"}</td>
      <td className="px-3 py-1.5">
        <button
          disabled={!canEdit || pending}
          onClick={() => start(() => toggleStoreActive(store.id, !store.active))}
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            store.active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"
          } disabled:opacity-60`}
        >
          {store.active ? "active" : "inactive"}
        </button>
      </td>
    </tr>
  );
}
