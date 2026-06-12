"use client";

import { useState, useTransition } from "react";
import { uploadPrime } from "./actions";
import type { UploadOutcome } from "./types";

export default function UploadPanel({
  runId,
  stores,
}: {
  runId: string;
  stores: { id: string; name: string; partner: string }[];
}) {
  const [pending, start] = useTransition();
  const [outcomes, setOutcomes] = useState<UploadOutcome[]>([]);
  const [forceStore, setForceStore] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (forceStore) fd.set("forceStoreId", forceStore);
    start(async () => {
      const res = await uploadPrime(runId, fd);
      setOutcomes(res);
    });
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold">Upload Prime stock</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Drop one or more Prime exports (.csv or .xlsx). Store is auto-detected from the file&apos;s Location column.
        Use the override to pin a single file to a store.
      </p>
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="files"
          multiple
          accept=".csv,.xlsx"
          className="text-sm"
          required
        />
        <select
          value={forceStore}
          onChange={(e) => setForceStore(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">Auto-detect store</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              Force: {s.name} ({s.partner})
            </option>
          ))}
        </select>
        <button
          disabled={pending}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>

      {outcomes.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {outcomes.map((o, i) => (
            <li key={i} className={o.ok ? "text-green-700" : "text-red-700"}>
              {o.ok ? "✓" : "✗"} {o.file} — {o.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
