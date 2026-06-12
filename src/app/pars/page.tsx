export const dynamic = "force-dynamic";
import { buildParMatrix } from "@/lib/par";
import { isAdmin } from "@/lib/current-user";
import ParUpload from "./ParUpload";
import ParMatrix from "./ParMatrix";

export default async function ParsPage() {
  const [matrix, canEdit] = await Promise.all([buildParMatrix(), isAdmin()]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pars (targets)</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Target stock per item × store. Requirement = max(par − live, 0).
        </p>
      </div>
      <ParUpload canEdit={canEdit} />
      <ParMatrix stores={matrix.stores} rows={matrix.rows} />
    </div>
  );
}
