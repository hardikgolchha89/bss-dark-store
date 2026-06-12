"use client";

import { useState, useTransition } from "react";
import { receiveAndUnlock, reopenToProcurement } from "./actions";

export default function PhaseControls({
  runId,
  phase,
  isFinal,
  isAdmin,
  receivedAt,
}: {
  runId: string;
  phase: "PROCUREMENT" | "DISTRIBUTION";
  isFinal: boolean;
  isAdmin: boolean;
  receivedAt: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const isProc = phase === "PROCUREMENT";

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Step active={isProc} done={!isProc} n={1} label="Procurement" sub="Consolidate + Material Requests" />
        <div className="h-px w-8 bg-neutral-300" />
        <Step active={!isProc} done={isFinal} n={2} label="Distribution" sub="Per-store POs + stock entry" />

        <div className="ml-auto flex items-center gap-2">
          {isProc && !isFinal && (
            <button
              onClick={() => {
                if (!confirm("Mark goods received? This unlocks the per-store distribution exports.")) return;
                start(async () => {
                  const r = await receiveAndUnlock(runId);
                  if (!r.ok) setError(r.message ?? "Failed");
                });
              }}
              disabled={pending || !isAdmin}
              title={!isAdmin ? "Admins only" : ""}
              className="rounded bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {pending ? "…" : "Mark received → unlock distribution"}
            </button>
          )}
          {!isProc && !isFinal && isAdmin && (
            <button
              onClick={() =>
                start(async () => {
                  const r = await reopenToProcurement(runId);
                  if (!r.ok) setError(r.message ?? "Failed");
                })
              }
              disabled={pending}
              className="rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
            >
              ← Reopen procurement
            </button>
          )}
        </div>
      </div>
      {receivedAt && !isProc && (
        <p className="mt-2 text-xs text-neutral-400">Received {new Date(receivedAt).toLocaleString()}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}

function Step({
  active,
  done,
  n,
  label,
  sub,
}: {
  active: boolean;
  done: boolean;
  n: number;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
          active ? "bg-indigo-700 text-white" : done ? "bg-green-600 text-white" : "bg-neutral-200 text-neutral-500"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div>
        <div className={`text-sm font-medium ${active ? "text-indigo-900" : "text-neutral-700"}`}>{label}</div>
        <div className="text-[11px] text-neutral-400">{sub}</div>
      </div>
    </div>
  );
}
