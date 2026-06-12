"use client";

import { useState, useTransition } from "react";
import { uploadPars } from "./actions";

export default function ParUpload({ canEdit }: { canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const res = await uploadPars(fd);
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) form.reset();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <a
        href="/api/pars/template"
        className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
      >
        ↓ Download current pars (template)
      </a>
      {canEdit ? (
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input type="file" name="file" accept=".xlsx,.csv" required className="text-sm" />
          <button
            disabled={pending}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {pending ? "Uploading…" : "Bulk upload"}
          </button>
        </form>
      ) : (
        <span className="text-sm text-neutral-400">Admins can bulk-upload changes.</span>
      )}
      {msg && (
        <span className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`}>
          {msg.ok ? "✓" : "✗"} {msg.text}
        </span>
      )}
    </div>
  );
}
