"use client";

import { useEffect, useState, useTransition } from "react";
import { SYNC_TABLES, type SyncTable } from "@/lib/sheet-sync";
import { checkSheets, pullFromSheet, pushToSheet } from "./sheets-actions";

export default function SheetsSync({ spreadsheetId }: { spreadsheetId: string }) {
  const [conn, setConn] = useState<{ ok: boolean; message: string; email?: string } | null>(null);
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [pending, start] = useTransition();
  const [checking, startCheck] = useTransition();

  useEffect(() => {
    startCheck(async () => setConn(await checkSheets()));
  }, []);

  function push(table: SyncTable) {
    start(async () => {
      const r = await pushToSheet(table);
      setMsg((m) => ({ ...m, [table]: { ok: r.ok, text: r.message } }));
    });
  }
  function pull(table: SyncTable) {
    const mirror = confirm(
      `PULL ${table} from the sheet?\n\nThis is MIRROR mode: rows in the database that are NOT in the sheet will be DELETED. ` +
        `Click Cancel to abort.\n\nTo proceed with delete-on-missing, click OK.`,
    );
    if (!mirror) return;
    start(async () => {
      const r = await pullFromSheet(table, true);
      setMsg((m) => ({ ...m, [table]: { ok: r.ok, text: r.message } }));
    });
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold">Google Sheets sync</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Two-way sync with one tab per table. <strong>Push</strong> overwrites the sheet tab from the DB.{" "}
        <strong>Pull</strong> is mirror mode — rows missing from the sheet are deleted in the DB (confirm required).
      </p>

      <div className="mb-3 rounded border p-2 text-xs">
        {checking && !conn ? (
          <span className="text-neutral-400">Checking connection…</span>
        ) : conn?.ok ? (
          <span className="text-green-700">✓ {conn.message}</span>
        ) : (
          <span className="text-red-700">
            ✗ {conn?.message ?? "Not connected"}
            {conn?.email && (
              <>
                {" "}
                — share the sheet with <code className="rounded bg-neutral-100 px-1">{conn.email}</code> (Editor).
              </>
            )}
          </span>
        )}
      </div>

      {!spreadsheetId && (
        <p className="mb-3 text-xs text-amber-700">
          Set the <strong>Google Sheet ID</strong> in the Sheets settings above first.
        </p>
      )}

      <div className="space-y-2">
        {SYNC_TABLES.map((t) => (
          <div key={t.key} className="flex items-center gap-3 border-t border-neutral-100 pt-2">
            <span className="w-44 text-sm font-medium">{t.label}</span>
            <span className="text-xs text-neutral-400">tab: {t.tab}</span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => push(t.key)}
                disabled={pending || !conn?.ok}
                className="rounded border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-40"
              >
                ↑ Push
              </button>
              <button
                onClick={() => pull(t.key)}
                disabled={pending || !conn?.ok}
                className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                ↓ Pull (mirror)
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1">
        {Object.entries(msg).map(([k, v]) => (
          <p key={k} className={`text-xs ${v.ok ? "text-green-700" : "text-red-700"}`}>
            {v.ok ? "✓" : "✗"} {v.text}
          </p>
        ))}
      </div>
    </section>
  );
}
