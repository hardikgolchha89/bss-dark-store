export const dynamic = "force-dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import DeleteRunButton from "./DeleteRunButton";

async function createRun(formData: FormData) {
  "use server";
  const label = String(formData.get("label") ?? "").trim();
  const dateStr = String(formData.get("runDate") ?? "");
  const runDate = dateStr ? new Date(dateStr) : new Date();
  const user = await getCurrentUser();
  const run = await prisma.run.create({
    data: { runDate, label, createdById: user?.id ?? null },
  });
  revalidatePath("/");
  redirect(`/runs/${run.id}`);
}

export default async function RunsPage() {
  const runs = await prisma.run.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { stocks: true, unmapped: true } }, createdBy: true },
  });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold">Daily runs</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Create a run, upload each store&apos;s Prime stock, review requirements, finalize, export POs.
        </p>
      </section>

      <form action={createRun} className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Run date</span>
          <input type="date" name="runDate" defaultValue={today} className="rounded border border-neutral-300 px-2 py-1.5" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Label (optional)</span>
          <input name="label" placeholder="e.g. Morning" className="rounded border border-neutral-300 px-2 py-1.5" />
        </label>
        <button className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
          New run
        </button>
      </form>

      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Label</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Stock rows</th>
              <th className="px-4 py-2 font-medium">Unmapped</th>
              <th className="px-4 py-2 font-medium">By</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-400">
                  No runs yet. Create one above.
                </td>
              </tr>
            )}
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-2">
                  <Link href={`/runs/${r.id}`} className="font-medium text-blue-700 hover:underline">
                    {r.runDate.toISOString().slice(0, 10)}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-600">{r.label || "—"}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      r.status === "FINALIZED"
                        ? "rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                        : "rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-neutral-600">{r._count.stocks}</td>
                <td className="px-4 py-2 text-neutral-600">{r._count.unmapped}</td>
                <td className="px-4 py-2 text-neutral-500">{r.createdBy?.email ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <DeleteRunButton runId={r.id} label={`${r.runDate.toISOString().slice(0, 10)}${r.label ? " · " + r.label : ""}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
