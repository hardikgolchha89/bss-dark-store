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
  const dt = String(formData.get("dayType") ?? "NORMAL");
  const dayType = dt === "WEEKEND" || dt === "PEAK" ? dt : "NORMAL";
  const user = await getCurrentUser();
  const run = await prisma.run.create({
    data: { runDate, label, dayType, createdById: user?.id ?? null },
  });
  revalidatePath("/");
  redirect(`/runs/${run.id}`);
}

const STEPS = [
  { t: "Create a run", d: "Pick today's date and hit New run." },
  { t: "Upload stock", d: "Drop each store's Prime export — store auto-detects." },
  { t: "Review & request", d: "Check requirements, download the 3 Material Requests (Mithai / Retail / Packaging)." },
  { t: "Mark received", d: "When goods arrive, unlock distribution." },
  { t: "Export per store", d: "Download per-store Prime POs + ERPNext stock entries." },
];

function HowItWorks() {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white shadow-soft">
      <div className="flex items-center gap-2 border-b border-line-light bg-cream-deep/60 px-4 py-2.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          How it works
        </span>
      </div>
      <ol className="grid gap-px bg-line-light sm:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={i} className="flex flex-col gap-2 bg-white p-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
              {i + 1}
            </span>
            <div className="text-sm font-semibold text-navy">{s.t}</div>
            <div className="text-xs leading-relaxed text-ink-soft">{s.d}</div>
          </li>
        ))}
      </ol>
    </section>
  );
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
        <h1 className="text-2xl font-bold text-navy">Daily runs</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Create a run, upload each store&apos;s Prime stock, review requirements, finalize, export POs.
        </p>
      </section>

      <HowItWorks />

      <form action={createRun} className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Run date</span>
          <input type="date" name="runDate" defaultValue={today} className="rounded border border-neutral-300 px-2 py-1.5" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Label (optional)</span>
          <input name="label" placeholder="e.g. Morning" className="rounded border border-neutral-300 px-2 py-1.5" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">Day type</span>
          <select name="dayType" defaultValue="NORMAL" className="rounded border border-neutral-300 px-2 py-1.5">
            <option value="NORMAL">Normal</option>
            <option value="WEEKEND">Weekend</option>
            <option value="PEAK">Peak / festive</option>
          </select>
        </label>
        <button className="rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light">
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
                  <Link href={`/runs/${r.id}`} className="font-medium text-teal-dark hover:underline">
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
