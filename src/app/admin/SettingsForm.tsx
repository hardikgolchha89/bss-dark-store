"use client";

import { useState, useTransition } from "react";
import { SETTING_DEFS, type SettingDef } from "@/lib/settings";
import { saveSetting } from "./actions";

export default function SettingsForm({ values }: { values: Record<string, string> }) {
  const groups = Array.from(new Set(SETTING_DEFS.map((d) => d.group)));
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g} className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">{g}</h2>
          <div className="space-y-3">
            {SETTING_DEFS.filter((d) => d.group === g).map((d) => (
              <SettingControl key={d.key} def={d} initial={values[d.key] ?? d.default} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SettingControl({ def, initial }: { def: SettingDef; initial: string }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function commit(v: string) {
    setValue(v);
    start(async () => {
      await saveSetting(def.key, v);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    });
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{def.label}</div>
        {def.help && <div className="text-xs text-neutral-500">{def.help}</div>}
      </div>
      <div className="flex items-center gap-2">
        {def.type === "bool" ? (
          <button
            disabled={pending}
            onClick={() => commit(value === "true" ? "false" : "true")}
            className={`relative h-6 w-11 rounded-full transition ${
              value === "true" ? "bg-green-600" : "bg-neutral-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                value === "true" ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        ) : (
          <input
            defaultValue={value}
            disabled={pending}
            onBlur={(e) => {
              if (e.target.value !== value) commit(e.target.value);
            }}
            className="w-72 rounded border border-neutral-300 px-2 py-1 text-sm"
          />
        )}
        {saved && <span className="text-xs text-green-600">saved</span>}
      </div>
    </div>
  );
}
