export const dynamic = "force-dynamic";
import { Partner } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/current-user";
import ItemsTable from "./ItemsTable";

export default async function ItemsPage() {
  const [items, canEdit] = await Promise.all([
    prisma.item.findMany({
      orderBy: { name: "asc" },
      include: { partnerSkus: { where: { partner: Partner.HK } } },
    }),
    isAdmin(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Items ({items.length})</h1>
        <p className="mt-1 text-sm text-neutral-500">
          The SKU master. {canEdit ? "Add MRP and ERPNext codes inline (saved instantly)." : "Read-only."}{" "}
          ERPNext export only includes items with a code.
        </p>
      </div>
      <ItemsTable
        canEdit={canEdit}
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category ?? "",
          hkSku: i.partnerSkus[0]?.skuCode ?? "",
          mrp: i.mrp,
          erpnextCode: i.erpnextCode,
        }))}
      />
    </div>
  );
}
