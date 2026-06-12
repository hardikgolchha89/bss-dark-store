"use client";

import { useState, useTransition } from "react";
import { finalize } from "./actions";

export default function FinalizeButton({
  runId,
  unresolvedUnmapped,
  blockOnUnmapped,
}: {
  runId: string;
  unresolvedUnmapped: number;
  blockOnUnmapped: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function onClick() {
    const warn =
      unresolvedUnmapped > 0
        ? `There are ${unresolvedUnmapped} unmapped SKU(s). Finalize anyway?`
        : "Finalize this run? It will lock and freeze the order numbers.";
    if (!confirm(warn)) return;
    start(async () => {
      const res = await finalize(runId);
      if (!res.ok) setError(res.message ?? "Finalize failed");
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={onClick}
        disabled={pending || (blockOnUnmapped && unresolvedUnmapped > 0)}
        className="rounded bg-green-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
        title={blockOnUnmapped && unresolvedUnmapped > 0 ? "Resolve unmapped SKUs first" : ""}
      >
        {pending ? "Finalizing…" : "Finalize"}
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </div>
  );
}
