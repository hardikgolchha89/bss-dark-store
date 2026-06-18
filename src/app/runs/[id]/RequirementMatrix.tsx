"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { saveAdjusted } from "./actions";

interface Row {
  id: string; // requirement id
  storeId: string;
  storeName: string;
  itemId: string;
  itemName: string;
  category: string;
  source: string; // fulfillment location (super-category); "" = unassigned
  par: number;
  live: number;
  suggested: number;
  adjusted: number;
  updatedAt: string;
}

interface StoreCol {
  id: string;
  name: string;
  partner: string;
}

type Cell = {
  id: string;
  par: number;
  live: number;
  suggested: number;
  adjusted: number;
  updatedAt: string;
};

interface ItemRow {
  itemId: string;
  itemName: string;
  category: string;
  source: string;
  cells: Record<string, Cell>;
}

const UNASSIGNED = "Unassigned";
type RowSort = "item" | "category" | "source";
type StoreSort = "default" | "name" | "partner";
type Status = "saving" | "saved" | "error";

export default function RequirementMatrix({
  runId,
  rows,
  stores,
  isFinal,
}: {
  runId: string;
  rows: Row[];
  stores: StoreCol[];
  isFinal: boolean;
}) {
  const [q, setQ] = useState("");
  const [rowSort, setRowSort] = useState<RowSort>("source");
  const [rowDir, setRowDir] = useState<1 | -1>(1);
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());
  const [storeSort, setStoreSort] = useState<StoreSort>("default");
  const [fullscreen, setFullscreen] = useState(false);

  const [edits, setEdits] = useState<Record<string, number>>({});
  const [versions, setVersions] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, start] = useTransition();

  // lock body scroll + allow Esc to leave fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  // pivot rows -> one ItemRow per item, with a cell per store
  const items = useMemo(() => {
    const map = new Map<string, ItemRow>();
    for (const r of rows) {
      let it = map.get(r.itemId);
      if (!it) {
        it = { itemId: r.itemId, itemName: r.itemName, category: r.category, source: r.source || UNASSIGNED, cells: {} };
        map.set(r.itemId, it);
      }
      it.cells[r.storeId] = {
        id: r.id,
        par: r.par,
        live: r.live,
        suggested: r.suggested,
        adjusted: r.adjusted,
        updatedAt: r.updatedAt,
      };
    }
    return [...map.values()];
  }, [rows]);

  const allSources = useMemo(
    () => [...new Set(items.map((i) => i.source))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const storeCols = useMemo(() => {
    const list = [...stores];
    if (storeSort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (storeSort === "partner")
      list.sort((a, b) => a.partner.localeCompare(b.partner) || a.name.localeCompare(b.name));
    return list;
  }, [stores, storeSort]);

  const visibleItems = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtered = items.filter(
      (i) =>
        !hiddenSources.has(i.source) &&
        (!t || i.itemName.toLowerCase().includes(t) || i.category.toLowerCase().includes(t)),
    );
    const key = (i: ItemRow) =>
      rowSort === "category" ? `${i.category}~${i.itemName}` : rowSort === "source" ? `${i.source}~${i.itemName}` : i.itemName;
    filtered.sort((a, b) => key(a).localeCompare(key(b)) * rowDir);
    return filtered;
  }, [items, q, hiddenSources, rowSort, rowDir]);

  const grouped = rowSort !== "item";
  const groupOf = (i: ItemRow) => (rowSort === "category" ? i.category || "—" : i.source);

  function save(cell: Cell, value: number) {
    const reqId = cell.id;
    setEdits((e) => ({ ...e, [reqId]: value }));
    setStatus((s) => ({ ...s, [reqId]: "saving" }));
    const expected = versions[reqId] ?? cell.updatedAt;
    start(async () => {
      const res = await saveAdjusted(runId, reqId, value, expected);
      if (res.ok) {
        setStatus((s) => ({ ...s, [reqId]: "saved" }));
        setVersions((v) => ({ ...v, [reqId]: new Date().toISOString() }));
        setErrors((e) => {
          const n = { ...e };
          delete n[reqId];
          return n;
        });
      } else {
        setStatus((s) => ({ ...s, [reqId]: "error" }));
        setErrors((e) => ({ ...e, [reqId]: res.message ?? "Save failed" }));
      }
    });
  }

  function toggleSource(s: string) {
    setHiddenSources((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-400">
        No requirement lines yet. Upload stock to populate.
      </section>
    );
  }

  const totalCols = 1 + storeCols.length * 4;

  const table = (
    <div className={fullscreen ? "h-[calc(100vh-3.25rem)] overflow-auto" : "max-h-[70vh] overflow-auto"}>
      <table className="border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th
              rowSpan={2}
              className="sticky left-0 top-0 z-30 w-56 min-w-56 border-b border-r border-neutral-300 bg-neutral-100 px-3 py-2 text-left font-medium text-neutral-600"
            >
              Item
            </th>
            {storeCols.map((s, idx) => (
              <th
                key={s.id}
                colSpan={4}
                className={`sticky top-0 z-20 border-b border-neutral-300 bg-neutral-100 px-2 py-1.5 text-center font-semibold text-neutral-700 ${
                  idx > 0 ? "border-l-2 border-l-neutral-300" : ""
                }`}
              >
                {s.name}
                <span className="ml-1 font-normal text-neutral-400">{s.partner}</span>
              </th>
            ))}
          </tr>
          <tr>
            {storeCols.map((s, idx) => (
              <SubHeads key={s.id} divider={idx > 0} />
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((it, i) => {
            const prev = visibleItems[i - 1];
            const showGroup = grouped && (!prev || groupOf(prev) !== groupOf(it));
            return (
              <FragmentRow
                key={it.itemId}
                it={it}
                storeCols={storeCols}
                isFinal={isFinal}
                edits={edits}
                status={status}
                errors={errors}
                onSave={save}
                groupLabel={showGroup ? groupOf(it) : null}
                groupCount={showGroup ? visibleItems.filter((x) => groupOf(x) === groupOf(it)).length : 0}
                totalCols={totalCols}
              />
            );
          })}
          {visibleItems.length === 0 && (
            <tr>
              <td colSpan={totalCols} className="px-3 py-6 text-center text-neutral-400">
                Nothing matches the current filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <section
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-white"
          : "overflow-hidden rounded-lg border border-neutral-200 bg-white"
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white p-2.5">
        <h2 className="text-sm font-semibold">Requirement matrix</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find item…"
          className="rounded border border-neutral-300 px-2 py-1 text-xs"
        />
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          Rows
          <select
            value={rowSort}
            onChange={(e) => setRowSort(e.target.value as RowSort)}
            className="rounded border border-neutral-300 px-1.5 py-1 text-xs"
          >
            <option value="source">by Fulfillment</option>
            <option value="category">by Category</option>
            <option value="item">by Item name</option>
          </select>
          <button
            onClick={() => setRowDir((d) => (d === 1 ? -1 : 1))}
            title="Reverse row order"
            className="rounded border border-neutral-300 px-1.5 py-1 hover:bg-neutral-50"
          >
            {rowDir === 1 ? "↓" : "↑"}
          </button>
        </label>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          Stores
          <select
            value={storeSort}
            onChange={(e) => setStoreSort(e.target.value as StoreSort)}
            className="rounded border border-neutral-300 px-1.5 py-1 text-xs"
          >
            <option value="default">default</option>
            <option value="name">A–Z</option>
            <option value="partner">by Partner</option>
          </select>
        </label>
        {allSources.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            {allSources.map((s) => {
              const on = !hiddenSources.has(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleSource(s)}
                  title={on ? "Click to hide" : "Click to show"}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    on ? "border-navy/30 bg-navy/5 text-navy" : "border-neutral-200 bg-neutral-50 text-neutral-300 line-through"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        )}
        <button
          onClick={() => setFullscreen((f) => !f)}
          className={`ml-auto rounded px-2 py-1 text-xs font-medium ${
            fullscreen
              ? "bg-navy text-white hover:bg-navy-light"
              : "border border-neutral-300 hover:bg-neutral-50"
          }`}
        >
          {fullscreen ? "✕ Exit full screen (Esc)" : "⤢ Full screen"}
        </button>
      </div>
      {table}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] text-neutral-500">
        <span>L Live · P Par · S Suggested · A Adjusted (editable)</span>
        <Legend className="bg-red-100 text-red-700">out of stock</Legend>
        <Legend className="bg-amber-50 text-amber-700">below par</Legend>
        <Legend className="bg-green-50 text-green-700">at / above par</Legend>
        <Legend className="bg-sky-50 text-sky-700">adjusted ≠ suggested</Legend>
        <span>✓ saved · ✗ failed</span>
      </div>
    </section>
  );
}

function SubHeads({ divider }: { divider: boolean }) {
  const base = "sticky top-7 z-20 border-b border-neutral-300 bg-neutral-100 px-2 py-1 text-right font-medium text-neutral-400";
  return (
    <>
      <th className={`${base} ${divider ? "border-l-2 border-l-neutral-300" : ""}`}>L</th>
      <th className={base}>P</th>
      <th className={base}>S</th>
      <th className={base}>A</th>
    </>
  );
}

function liveClass(live: number, par: number): string {
  if (live < 0) return "bg-red-200 font-semibold text-red-800";
  if (live === 0) return "bg-red-100 text-red-700";
  if (live < par) return "bg-amber-50 text-amber-700";
  return "bg-green-50 text-green-700";
}

function FragmentRow({
  it,
  storeCols,
  isFinal,
  edits,
  status,
  errors,
  onSave,
  groupLabel,
  groupCount,
  totalCols,
}: {
  it: ItemRow;
  storeCols: StoreCol[];
  isFinal: boolean;
  edits: Record<string, number>;
  status: Record<string, Status>;
  errors: Record<string, string>;
  onSave: (cell: Cell, value: number) => void;
  groupLabel: string | null;
  groupCount: number;
  totalCols: number;
}) {
  return (
    <>
      {groupLabel !== null && (
        <tr>
          <td
            colSpan={totalCols}
            className="sticky left-0 z-10 border-y border-neutral-200 bg-cream-deep/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-navy"
          >
            {groupLabel} <span className="font-normal text-neutral-400">· {groupCount}</span>
          </td>
        </tr>
      )}
      <tr className="hover:bg-neutral-50/60">
        <th className="sticky left-0 z-10 w-56 min-w-56 border-b border-r border-neutral-200 bg-white px-3 py-1 text-left align-top font-normal">
          <div className="truncate font-medium text-neutral-800" title={it.itemName}>
            {it.itemName}
          </div>
          <div className="truncate text-[10px] text-neutral-400">
            {it.source}
            {it.category ? ` · ${it.category}` : ""}
          </div>
        </th>
        {storeCols.map((s, idx) => {
          const cell = it.cells[s.id];
          const divider = idx > 0 ? "border-l-2 border-l-neutral-200" : "";
          if (!cell) {
            return (
              <td key={s.id} colSpan={4} className={`border-b border-neutral-100 bg-neutral-50/40 ${divider}`} />
            );
          }
          const value = edits[cell.id] ?? cell.adjusted;
          const st = status[cell.id];
          const edited = value !== cell.suggested;
          return (
            <CellGroup
              key={s.id}
              cell={cell}
              value={value}
              edited={edited}
              status={st}
              error={errors[cell.id]}
              isFinal={isFinal}
              divider={divider}
              onSave={onSave}
            />
          );
        })}
      </tr>
    </>
  );
}

function CellGroup({
  cell,
  value,
  edited,
  status,
  error,
  isFinal,
  divider,
  onSave,
}: {
  cell: Cell;
  value: number;
  edited: boolean;
  status?: Status;
  error?: string;
  isFinal: boolean;
  divider: string;
  onSave: (cell: Cell, value: number) => void;
}) {
  const num = "border-b border-neutral-100 px-2 py-1 text-right tabular-nums";
  return (
    <>
      <td className={`${num} ${divider} ${liveClass(cell.live, cell.par)}`}>{cell.live}</td>
      <td className={`${num} text-neutral-500`}>{cell.par}</td>
      <td className={`${num} text-neutral-400`}>{cell.suggested}</td>
      <td className={`${num} ${edited ? "bg-sky-50" : ""}`}>
        <div className="flex items-center justify-end gap-0.5">
          <input
            type="number"
            min={0}
            defaultValue={value}
            disabled={isFinal}
            onBlur={(e) => {
              const n = Math.max(0, Math.round(Number(e.target.value)));
              if (n !== (value ?? cell.adjusted)) onSave(cell, n);
            }}
            className={`w-12 rounded border px-1 py-0.5 text-right tabular-nums ${
              status === "error" ? "border-red-400 bg-red-50" : edited ? "border-sky-300" : "border-neutral-200"
            } disabled:bg-neutral-100`}
          />
          <span className="w-3 text-center" title={error}>
            {status === "saving" && <span className="text-neutral-300">…</span>}
            {status === "saved" && <span className="text-green-600">✓</span>}
            {status === "error" && <span className="text-red-600">✗</span>}
          </span>
        </div>
      </td>
    </>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded-sm ${className}`} />
      {children}
    </span>
  );
}
