"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRun } from "./run-list-actions";

export default function DeleteRunButton({
  runId,
  label,
  redirectTo,
}: {
  runId: string;
  label: string; // shown in the confirm
  redirectTo?: string; // navigate here after delete (e.g. from a run detail page)
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => {
          if (!confirm(`Delete run "${label}"? This removes its stock, requirements, and unmapped SKUs. Cannot be undone.`))
            return;
          start(async () => {
            const r = await deleteRun(runId);
            if (!r.ok) setError(r.message ?? "Delete failed");
            else if (redirectTo) router.push(redirectTo);
          });
        }}
        disabled={pending}
        className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        title="Delete run"
      >
        {pending ? "…" : "Delete"}
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </>
  );
}
