export const dynamic = "force-dynamic";
import { getSettingsMap } from "@/lib/run-engine";
import { getCurrentUser, isAdmin } from "@/lib/current-user";
import SettingsForm from "./SettingsForm";

export default async function AdminPage() {
  const [values, admin, user] = await Promise.all([getSettingsMap(), isAdmin(), getCurrentUser()]);

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
        <SettingsForm values={values} />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You&apos;re not an admin. Ask an admin to change these settings.
        </div>
      )}
    </div>
  );
}
