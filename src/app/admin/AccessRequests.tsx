import type { AccessStatus, Role } from "@prisma/client";
import { setUserAccess, setUserRole } from "./actions";

export interface AccessUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: AccessStatus;
}

const STATUS_BADGE: Record<AccessStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  BLOCKED: "bg-red-100 text-red-700",
};

function Btn({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "green" | "red" | "neutral" }) {
  const tones = {
    green: "border-green-300 text-green-700 hover:bg-green-50",
    red: "border-red-300 text-red-700 hover:bg-red-50",
    neutral: "border-neutral-300 text-neutral-700 hover:bg-neutral-50",
  } as const;
  return <button className={`rounded border px-2 py-1 text-xs ${tones[tone]}`}>{children}</button>;
}

// Admin-only: external (non-company) users who signed in and need an access
// decision. Company-domain users never appear here — they're allowed by default.
export default function AccessRequests({ users }: { users: AccessUser[] }) {
  const pending = users.filter((u) => u.status === "PENDING").length;
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold">
        Access requests
        {pending > 0 && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {pending} waiting
          </span>
        )}
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        External (non-@bombaysweetshop.com) accounts that have signed in. Approve to let them use the
        app; block to turn access off. Company accounts are allowed automatically and don&apos;t show
        here.
      </p>

      {users.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">No external accounts yet.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">
                    <div className="font-medium">{u.email}</div>
                    {u.name && <div className="text-xs text-neutral-400">{u.name}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[u.status]}`}>
                      {u.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{u.role.toLowerCase()}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      {u.status !== "APPROVED" && (
                        <form action={setUserAccess.bind(null, u.id, "APPROVED")}>
                          <Btn tone="green">Approve</Btn>
                        </form>
                      )}
                      {u.status !== "BLOCKED" && (
                        <form action={setUserAccess.bind(null, u.id, "BLOCKED")}>
                          <Btn tone="red">Block</Btn>
                        </form>
                      )}
                      {u.status === "APPROVED" &&
                        (u.role === "ADMIN" ? (
                          <form action={setUserRole.bind(null, u.id, "MEMBER" as Role)}>
                            <Btn>Make member</Btn>
                          </form>
                        ) : (
                          <form action={setUserRole.bind(null, u.id, "ADMIN" as Role)}>
                            <Btn>Make admin</Btn>
                          </form>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
