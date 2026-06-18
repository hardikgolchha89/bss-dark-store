"use client";

import { useState } from "react";

// Rebel POs need an ERP stock-entry / invoice number stamped on every row
// (Rebel isn't wired to ERP), so we ask for it before downloading the zip.
export default function RebelPoDownload({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  const [num, setNum] = useState("");

  function download() {
    const inv = num.trim();
    if (!inv) return;
    window.location.href = `/api/runs/${runId}/export?type=rebel_po_zip&invoice=${encodeURIComponent(inv)}`;
    setOpen(false);
    setNum("");
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
      >
        ↓ Rebel POs — per store (.zip)
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded border border-rose-300 bg-rose-50/60 px-2 py-1.5">
      <label className="text-xs text-rose-900">Stock-entry no.</label>
      <input
        autoFocus
        value={num}
        onChange={(e) => setNum(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") download();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="e.g. BSS-N-TAR-12814"
        className="w-44 rounded border border-neutral-300 px-2 py-1 text-sm"
      />
      <button
        onClick={download}
        disabled={!num.trim()}
        className="rounded bg-navy px-3 py-1 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-40"
      >
        Download
      </button>
      <button onClick={() => setOpen(false)} className="rounded px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100">
        ✕
      </button>
    </div>
  );
}
