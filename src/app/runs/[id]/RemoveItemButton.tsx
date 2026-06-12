"use client";

import { useTransition } from "react";
import { removeItemFromOrder } from "./actions";

export default function RemoveItemButton({
  runId,
  itemId,
  name,
}: {
  runId: string;
  itemId: string;
  name: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      title="Remove this item from the whole order"
      onClick={() => {
        if (!confirm(`Remove "${name}" from the order entirely (all stores)?`)) return;
        start(async () => {
          await removeItemFromOrder(runId, itemId);
        });
      }}
      className="rounded px-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      ✕
    </button>
  );
}
