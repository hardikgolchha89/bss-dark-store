export const dynamic = "force-dynamic";
import { Partner } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/current-user";
import ItemsTable from "./ItemsTable";
import ErpCodeUpload from "./ErpCodeUpload";

export default async function ItemsPage() {
  const [items, canEdit, sources] = await Promise.all([
    prisma.item.findMany({
      orderBy: { name: "asc" },
      include: { partnerSkus: { where: { partner: { in: [Partner.HK, Partner.REBEL] } } } },
    }),
    isAdmin(),
    prisma.materialSource.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Items ({items.length})</h1>
          <p className="mt-1 text-sm text-neutral-500">
            The SKU master. {canEdit ? "Add MRP and ERPNext codes inline (saved instantly)." : "Read-only."}{" "}
            ERPNext export only includes items with a code.
          </p>
        </div>
        <a
          href="/api/items/export"
          className="shrink-0 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          ↓ Export CSV (HK SKU · Name · ERPNext · Rebel SKU)
        </a>
      </div>
      {canEdit && <ErpCodeUpload />}
      <ItemsTable
        canEdit={canEdit}
        sources={sources.map((s) => ({ id: s.id, name: s.name }))}
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category ?? "",
          hkSku: i.partnerSkus.find((s) => s.partner === Partner.HK)?.skuCode ?? "",
          rebelSku: i.partnerSkus.find((s) => s.partner === Partner.REBEL)?.skuCode ?? "",
          mrp: i.mrp,
          erpnextCode: i.erpnextCode,
          fulfillmentSourceId: i.fulfillmentSourceId,
          active: i.active,
        }))}
      />
    </div>
  );
}
