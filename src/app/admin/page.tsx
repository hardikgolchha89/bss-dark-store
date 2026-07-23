export const dynamic = "force-dynamic";
import { getSettingsMap } from "@/lib/run-engine";
import { getCurrentUser, isAdmin } from "@/lib/current-user";
import { isBootstrapAllowed } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import SettingsForm from "./SettingsForm";
import SheetsSync from "./SheetsSync";
import AccessRequests, { type AccessUser } from "./AccessRequests";

const STATUS_ORDER = { PENDING: 0, APPROVED: 1, BLOCKED: 2 } as const;

export default async function AdminPage() {
  const [values, admin, user] = await Promise.all([getSettingsMap(), isAdmin(), getCurrentUser()]);

  // External (non-company) accounts only — company-domain users are auto-allowed
  // and don't need managing. Pending requests float to the top.
  let accessUsers: AccessUser[] = [];
  if (admin) {
    const all = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, status: true },
      orderBy: { email: "asc" },
    });
    accessUsers = all
      .filter((u) => !isBootstrapAllowed(u.email))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Feature flags and settings. Changes apply to everyone immediately. Signed in as{" "}
          <span className="font-medium">{user?.email ?? "unknown"}</span> ({user?.role ?? "—"}).
        </p>
      </div>
      {admin ? (
        <>
          <AccessRequests users={accessUsers} />
          <SettingsForm values={values} />
          <SheetsSync spreadsheetId={values.sheets_spreadsheet_id ?? ""} />
        </>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You&apos;re not an admin. Ask an admin to change these settings.
        </div>
      )}
    </div>
  );
}
