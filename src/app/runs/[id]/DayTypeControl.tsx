"use client";

import { useState, useTransition } from "react";
import { changeDayType } from "./actions";

type DayType = "NORMAL" | "WEEKEND" | "PEAK";

export default function DayTypeControl({
  runId,
  dayType,
  weekendPct,
  peakPct,
  isFinal,
}: {
  runId: string;
  dayType: DayType;
  weekendPct: number;
  peakPct: number;
  isFinal: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const pct = dayType === "WEEKEND" ? weekendPct : dayType === "PEAK" ? peakPct : 0;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Day type
      </span>
      <select
        value={dayType}
        disabled={isFinal || pending}
        onChange={(e) =>
          start(async () => {
            const r = await changeDayType(runId, e.target.value as DayType);
            if (!r.ok) setError(r.message ?? "Failed");
          })
        }
        className="rounded border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-100"
      >
        <option value="NORMAL">Normal</option>
        <option value="WEEKEND">Weekend (+{weekendPct}%)</option>
        <option value="PEAK">Peak (+{peakPct}%)</option>
      </select>
      {pct > 0 && (
        <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-gold-dark">
          pars +{pct}%
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
