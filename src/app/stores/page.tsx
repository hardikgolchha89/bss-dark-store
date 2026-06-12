export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/current-user";
import StoreRow from "./StoreRow";

export default async function StoresPage() {
  const [stores, canEdit] = await Promise.all([
    prisma.store.findMany({ orderBy: [{ partner: "asc" }, { sortOrder: "asc" }] }),
    isAdmin(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Stores</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {canEdit ? "Assign tiers (saved for everyone) and toggle active." : "Read-only — admins can edit tiers."}{" "}
          Tier sets the default par; per-store overrides win.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Store</th>
              <th className="px-3 py-2 font-medium">Partner</th>
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 font-medium">ERPNext warehouse</th>
              <th className="px-3 py-2 font-medium">Location aliases</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <StoreRow
                key={s.id}
                canEdit={canEdit}
                store={{
                  id: s.id,
                  name: s.name,
                  partner: s.partner,
                  tier: s.tier,
                  active: s.active,
                  erpnextWarehouseId: s.erpnextWarehouseId,
                  locationAliases: s.locationAliases,
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
