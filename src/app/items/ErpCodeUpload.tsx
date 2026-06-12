"use client";

import { useState, useTransition } from "react";
import { uploadErpCodes } from "./erp-actions";

export default function ErpCodeUpload() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await uploadErpCodes(fd);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <span className="text-sm font-medium">Import ERP item codes</span>
      <span className="text-xs text-neutral-500">HK SKU → ERP mapping (.csv/.xlsx)</span>
      <input type="file" name="file" accept=".csv,.xlsx" required className="text-sm" />
      <button
        disabled={pending}
        className="rounded bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import"}
      </button>
      {msg && <span className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.ok ? "✓" : "✗"} {msg.text}</span>}
    </form>
  );
}
