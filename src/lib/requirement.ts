// Pure replenishment math. No DB, no IO — unit-testable in isolation.
//
// Par resolution:  par = override(item,store) ?? template(item, store.tier) ?? 0
// Requirement:     suggested = max( par - max(live,0), 0 )
//
// Negative live stock is Prime inventory drift; we clamp it to 0 so a store at
// -2 is replenished UP TO par, not par+2. The negative is surfaced separately
// as an anomaly (see isAnomalousLive).

export type Tier = "A" | "B" | "C";

export function resolvePar(
  override: number | null | undefined,
  template: number | null | undefined,
): number {
  if (override !== null && override !== undefined) return override;
  if (template !== null && template !== undefined) return template;
  return 0;
}

export function suggestedQty(par: number, live: number): number {
  const effectiveLive = Math.max(live, 0);
  return Math.max(par - effectiveLive, 0);
}

// A live value that should be flagged for the validation panel.
export function isAnomalousLive(live: number): boolean {
  return live < 0;
}
