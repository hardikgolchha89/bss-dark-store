import Link from "next/link";
import { notFound } from "next/navigation";
import { Partner } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureManualStores, getSettingsMap } from "@/lib/run-engine";
import { getProcurementSummary } from "@/lib/procurement";
import { asBool } from "@/lib/settings";
import UploadPanel from "./UploadPanel";
import RequirementMatrix from "./RequirementMatrix";
import FinalizeButton from "./FinalizeButton";
import UnmappedPanel from "./UnmappedPanel";
import RemoveItemButton from "./RemoveItemButton";
import DayTypeControl from "./DayTypeControl";
import RebelPoDownload from "./RebelPoDownload";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.run.findUnique({ where: { id } });
  if (!run) notFound();

  // CZ/Rebel stores have no live feed — seed them at live=0 (suggested=par).
  await ensureManualStores(id);

  const [stores, reqs, unmapped, items, settings] = await Promise.all([
    prisma.store.findMany({ where: { active: true }, orderBy: [{ partner: "asc" }, { sortOrder: "asc" }] }),
    prisma.runRequirement.findMany({
      where: { runId: id, removed: false, item: { active: true } },
      include: {
        item: { include: { partnerSkus: { where: { partner: Partner.HK } }, fulfillmentSource: true } },
        store: true,
      },
      orderBy: [{ store: { sortOrder: "asc" } }, { item: { name: "asc" } }],
    }),
    prisma.unmappedSku.findMany({ where: { runId: id, ignored: false }, orderBy: { skuCode: "asc" } }),
    prisma.item.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getSettingsMap(),
  ]);

  const procurement = await getProcurementSummary(id);

  const uploaded = await prisma.runStock.groupBy({
    by: ["storeId"],
    where: { runId: id },
    _count: { storeId: true },
    _sum: { liveQty: true },
  });
  const storeById = new Map(stores.map((s) => [s.id, s]));
  const uploadedStores = uploaded
    .map((u) => ({
      id: u.storeId,
      name: storeById.get(u.storeId)?.name ?? "?",
      partner: String(storeById.get(u.storeId)?.partner ?? ""),
      items: u._count.storeId,
      units: u._sum.liveQty ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const isFinal = run.status === "FINALIZED";
  const storesWithStock = new Set(reqs.map((r) => r.storeId));
  const notUploaded = stores.filter((s) => !storesWithStock.has(s.id));
  const anomalies = reqs.filter((r) => r.liveUsed < 0).length;
  const unresolvedUnmapped = unmapped.filter((u) => !u.resolvedItemId).length;

  const totalAdjusted = reqs.reduce((a, r) => a + r.adjusted, 0);
  const totalSuggested = reqs.reduce((a, r) => a + r.suggested, 0);
  const possibleRevenue = reqs.reduce((a, r) => a + r.adjusted * (r.item.mrp ?? 0), 0);

  const gridRows = reqs.map((r) => ({
    id: r.id,
    storeId: r.storeId,
    storeName: r.store.name,
    itemId: r.itemId,
    itemName: r.item.name,
    category: r.item.category ?? "",
    source: r.item.fulfillmentSource?.name ?? "",
    par: r.parUsed,
    live: r.liveUsed,
    suggested: r.suggested,
    adjusted: r.adjusted,
    updatedAt: r.updatedAt.toISOString(),
  }));

  // store columns for the matrix: only stores that actually have lines, in
  // partner+sortOrder order (matches the `stores` query).
  const storesWithLines = new Set(gridRows.map((r) => r.storeId));
  const matrixStores = stores
    .filter((s) => storesWithLines.has(s.id))
    .map((s) => ({ id: s.id, name: s.name, partner: String(s.partner), tier: s.tier }));

  // Consolidated by item: live / par / suggested / adjusted totalled across
  // stores, so they can compare the four columns before submitting.
  const orderMap = new Map<
    string,
    { itemId: string; sku: string; name: string; category: string; stores: number; live: number; par: number; suggested: number; adjusted: number }
  >();
  for (const r of reqs) {
    if (r.adjusted <= 0 && r.suggested <= 0) continue;
    const g = orderMap.get(r.itemId) ?? {
      itemId: r.itemId,
      sku: r.item.partnerSkus[0]?.skuCode ?? "",
      name: r.item.name,
      category: r.item.category ?? "",
      stores: 0,
      live: 0,
      par: 0,
      suggested: 0,
      adjusted: 0,
    };
    g.stores += 1;
    g.live += r.liveUsed;
    g.par += r.parUsed;
    g.suggested += r.suggested;
    g.adjusted += r.adjusted;
    orderMap.set(r.itemId, g);
  }
  const orderLines = [...orderMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const orderTotals = orderLines.reduce(
    (a, l) => ({ live: a.live + l.live, par: a.par + l.par, suggested: a.suggested + l.suggested, adjusted: a.adjusted + l.adjusted }),
    { live: 0, par: 0, suggested: 0, adjusted: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:underline">
            ← All runs
          </Link>
          <h1 className="text-xl font-semibold">
            Run {run.runDate.toISOString().slice(0, 10)} {run.label && <span className="text-neutral-400">· {run.label}</span>}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <DayTypeControl
            runId={id}
            dayType={run.dayType}
            weekendPct={Number(settings.weekend_buffer_pct) || 0}
            peakPct={Number(settings.peak_buffer_pct) || 0}
            isFinal={isFinal}
          />
          <span
            className={
              isFinal
                ? "rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                : "rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700"
            }
          >
            {run.status}
          </span>
          {!isFinal && (
            <FinalizeButton runId={id} unresolvedUnmapped={unresolvedUnmapped} blockOnUnmapped={asBool(settings.block_finalize_on_unmapped)} />
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Stores uploaded" value={`${storesWithStock.size}/${stores.length}`} />
        <Kpi label="Total suggested" value={totalSuggested.toLocaleString()} />
        <Kpi label="Total adjusted" value={totalAdjusted.toLocaleString()} />
        {asBool(settings.show_possible_revenue_kpi) && (
          <Kpi label="Possible revenue" value={`₹${Math.round(possibleRevenue).toLocaleString("en-IN")}`} />
        )}
      </div>

      {/* Validation */}
      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Validation</h2>
        <ul className="space-y-1 text-sm">
          <li className={notUploaded.length ? "text-amber-700" : "text-green-700"}>
            {notUploaded.length
              ? `${notUploaded.length} store(s) not uploaded: ${notUploaded.map((s) => s.name).join(", ")}`
              : "All active stores have stock."}
          </li>
          <li className={unresolvedUnmapped ? "text-amber-700" : "text-green-700"}>
            {unresolvedUnmapped ? `${unresolvedUnmapped} unmapped SKU(s) — resolve below.` : "No unmapped SKUs."}
          </li>
          <li className={anomalies ? "text-amber-700" : "text-green-700"}>
            {anomalies ? `${anomalies} negative stock value(s) (clamped to 0 in orders).` : "No negative stock."}
          </li>
        </ul>
      </section>

      <UploadedStores rows={uploadedStores} total={stores.length} />

      {!isFinal && <UploadPanel runId={id} stores={stores.map((s) => ({ id: s.id, name: s.name, partner: s.partner }))} />}

      {unmapped.length > 0 && (
        <UnmappedPanel
          runId={id}
          isFinal={isFinal}
          items={items}
          unmapped={unmapped.map((u) => ({
            id: u.id,
            skuCode: u.skuCode,
            partner: u.partner,
            rawName: u.rawName ?? "",
            resolvedItemId: u.resolvedItemId,
          }))}
        />
      )}

      <RequirementMatrix runId={id} rows={gridRows} stores={matrixStores} isFinal={isFinal} />

      <OrderPreview runId={id} lines={orderLines} totals={orderTotals} isFinal={isFinal} />

      <ProcurementPanel runId={id} procurement={procurement} />

      <ExportsBar runId={id} isFinal={isFinal} settings={settings} />
    </div>
  );
}

function OrderPreview({
  runId,
  lines,
  totals,
  isFinal,
}: {
  runId: string;
  lines: { itemId: string; sku: string; name: string; category: string; stores: number; live: number; par: number; suggested: number; adjusted: number }[];
  totals: { live: number; par: number; suggested: number; adjusted: number };
  isFinal: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <details open>
        <summary className="cursor-pointer list-none border-b border-neutral-200 p-3 text-sm font-semibold">
          Consolidated — {lines.length} items
          <span className="ml-2 font-normal text-neutral-400">
            (totalled across stores · compare Live / Par / Suggested / Adjusted before submitting)
          </span>
        </summary>
        <div className="max-h-[55vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-100 text-left text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">Stores</th>
                <th className="px-3 py-2 text-right font-medium">Live</th>
                <th className="px-3 py-2 text-right font-medium">Par</th>
                <th className="px-3 py-2 text-right font-medium">Suggested</th>
                <th className="px-3 py-2 text-right font-medium">Adjusted</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-neutral-400">
                    Nothing to order yet.
                  </td>
                </tr>
              )}
              {lines.map((l) => (
                <tr key={l.sku + l.name} className="border-t border-neutral-100">
                  <td className="px-3 py-1.5 tabular-nums text-neutral-500">{l.sku}</td>
                  <td className="px-3 py-1.5">{l.name}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{l.category}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">{l.stores}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">{l.live}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">{l.par}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-neutral-400">{l.suggested}</td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">{l.adjusted}</td>
                  <td className="px-2 py-1.5 text-right">
                    {!isFinal && <RemoveItemButton runId={runId} itemId={l.itemId} name={l.name} />}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={4}>
                  Totals
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.live.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.par.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.suggested.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.adjusted.toLocaleString()}</td>
                <td className="px-2 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
    </section>
  );
}

function ProcurementPanel({
  runId,
  procurement,
}: {
  runId: string;
  procurement: Awaited<ReturnType<typeof getProcurementSummary>>;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
      <div>
        <h2 className="text-sm font-semibold text-indigo-900">Procurement — Material Requests</h2>
        <p className="text-xs text-indigo-700">
          Total requirement <strong>{procurement.itemCount}</strong> items · {procurement.totalUnits.toLocaleString()}{" "}
          units, split by each item&apos;s <strong>fulfillment location</strong>. Each file holds only that team&apos;s
          items — raise it as a Material Request in ERP.
        </p>
      </div>

      {procurement.unassignedCount > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          <strong>{procurement.unassignedCount} item(s)</strong> ({procurement.unassignedUnits.toLocaleString()} units)
          have no fulfillment location set, so they aren&apos;t on any Material Request. Assign them in{" "}
          <a className="underline" href="/items">Items → Fulfillment</a>.
        </div>
      )}
      {procurement.itemsMissingErpCode > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-700">
          {procurement.itemsMissingErpCode} item(s) have no ERPNext item code yet (blank item_code column). Add codes in{" "}
          <a className="underline" href="/items">Items</a>.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {procurement.sources.map((s) => (
          <div key={s.id} className="rounded-lg border border-neutral-200 bg-white p-3">
            <h3 className="text-sm font-semibold">{s.name}</h3>
            <div className="mt-1 text-[11px] text-neutral-400">{s.erpnextWarehouseId ?? "no warehouse set"}</div>
            <div className="mt-2 text-xs text-neutral-600">
              {s.itemCount} items · {s.units.toLocaleString()} units
            </div>
            <a
              href={`/api/runs/${runId}/export?type=mr&source=${s.id}`}
              className={`mt-2 inline-block rounded border px-2 py-1 text-xs font-medium ${
                s.itemCount
                  ? "border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50"
                  : "pointer-events-none border-neutral-200 text-neutral-300"
              }`}
            >
              ↓ Material Request
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

function UploadedStores({
  rows,
  total,
}: {
  rows: { id: string; name: string; partner: string; items: number; units: number }[];
  total: number;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 p-3 text-sm font-semibold">
        Uploaded stores — {rows.length}/{total}
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-neutral-400">No stock uploaded yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Store</th>
              <th className="px-4 py-2 font-medium">Partner</th>
              <th className="px-4 py-2 text-right font-medium">SKUs matched</th>
              <th className="px-4 py-2 text-right font-medium">Units on hand</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="px-4 py-1.5 font-medium">{r.name}</td>
                <td className="px-4 py-1.5 text-neutral-500">{r.partner}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{r.items}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{r.units.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function ExportsBar({
  runId,
  isFinal,
  settings,
}: {
  runId: string;
  isFinal: boolean;
  settings: Record<string, string>;
}) {
  const links: { type: string; label: string }[] = [
    { type: "po_zip", label: "Prime POs — per store (.zip)" },
  ];
  if (asBool(settings.erpnext_export_enabled)) {
    links.push({ type: "erp_zip", label: "ERPNext stock entries — per store (.zip)" });
  }
  links.push({ type: "consolidated", label: "Consolidated printout" });
  // single-file fallbacks
  links.push({ type: "po_hk", label: "HK PO — one file (all stores)" });

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold">Distribution exports (per store)</h2>
      {!isFinal && (
        <p className="mb-3 text-xs text-amber-700">
          Draft — exports reflect current adjusted values; finalize to freeze the record.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {links.map((l) => (
          <a
            key={l.type}
            href={`/api/runs/${runId}/export?type=${l.type}`}
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            ↓ {l.label}
          </a>
        ))}
        <RebelPoDownload runId={runId} />
      </div>
    </section>
  );
}
