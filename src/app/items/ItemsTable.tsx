"use client";

import { useMemo, useState, useTransition } from "react";
import { createItem, setItemFulfillment, setItemRebelSku, updateItem } from "./actions";

interface Item {
  id: string;
  name: string;
  category: string;
  hkSku: string;
  rebelSku: string;
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
        i.rebelSku.toLowerCase().includes(t) ||
        i.category.toLowerCase().includes(t) ||
        (i.erpnextCode ?? "").toLowerCase().includes(t),
    );
  }, [q, items]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, SKU, category, ERPNext code…"
          className="w-full max-w-md rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        {canEdit && <AddItem sources={sources} />}
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">HK SKU</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">MRP</th>
              <th className="px-3 py-2 font-medium">ERPNext code</th>
              <th className="px-3 py-2 font-medium">Rebel SKU</th>
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
                  <input
                    defaultValue={i.rebelSku}
                    disabled={!canEdit}
                    placeholder="—"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === i.rebelSku) return;
                      start(async () => {
                        const r = await setItemRebelSku(i.id, v);
                        if (!r.ok) {
                          alert(r.message ?? "Could not save Rebel SKU");
                          e.target.value = i.rebelSku;
                        }
                      });
                    }}
                    className="w-36 rounded border border-neutral-300 px-2 py-1 tabular-nums disabled:bg-neutral-100"
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
                <td colSpan={7} className="px-3 py-6 text-center text-neutral-400">
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

function AddItem({ sources }: { sources: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setErr(null);
    start(async () => {
      const res = await createItem({
        name: String(fd.get("name") ?? ""),
        category: String(fd.get("category") ?? ""),
        hkSku: String(fd.get("hkSku") ?? ""),
        rebelSku: String(fd.get("rebelSku") ?? ""),
        mrp: fd.get("mrp") ? Number(fd.get("mrp")) : null,
        erpnextCode: String(fd.get("erpnextCode") ?? ""),
        fulfillmentSourceId: String(fd.get("fulfillmentSourceId") ?? "") || null,
      });
      if (res.ok) {
        form.reset();
        setOpen(false);
      } else {
        setErr(res.message ?? "Could not add item.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy-light"
      >
        + Add item
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-cream-deep/40 p-3"
    >
      <Field label="HK SKU *" name="hkSku" placeholder="16223" required width="w-28" />
      <Field label="Name *" name="name" placeholder="Item name" required width="w-56" />
      <Field label="Category" name="category" placeholder="e.g. Mithai" width="w-36" />
      <Field label="MRP" name="mrp" type="number" placeholder="0.00" width="w-24" />
      <Field label="ERPNext code" name="erpnextCode" placeholder="—" width="w-36" />
      <Field label="Rebel SKU" name="rebelSku" placeholder="SLMBSS…" width="w-32" />
      <label className="text-xs">
        <span className="mb-1 block text-neutral-500">Fulfillment</span>
        <select name="fulfillmentSourceId" defaultValue="" className="rounded border border-neutral-300 px-2 py-1.5 text-sm">
          <option value="">— unassigned —</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          className="rounded bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-50"
        >
          {pending ? "Adding…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setErr(null); }}
          className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
      {err && <p className="w-full text-xs text-red-600">{err}</p>}
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required = false,
  width = "w-40",
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  width?: string;
}) {
  return (
    <label className="text-xs">
      <span className="mb-1 block text-neutral-500">{label}</span>
      <input
        name={name}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        placeholder={placeholder}
        required={required}
        className={`${width} rounded border border-neutral-300 px-2 py-1.5 text-sm`}
      />
    </label>
  );
}
