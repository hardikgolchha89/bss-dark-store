// SKU codes are identifiers, not numbers. Excel hands us floats like 16223.0.
// Canonicalize everywhere we read a code so HK/CZ/Rebel codes never mismatch
// on float formatting or stray whitespace.
export function canonicalSku(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "number") {
    // 16223.0 -> "16223"; keep real decimals if ever present (unlikely for SKUs).
    return Number.isInteger(raw) ? String(raw) : String(raw);
  }
  const s = String(raw).trim();
  // "16223.0" -> "16223"
  const m = s.match(/^(\d+)\.0+$/);
  return m ? m[1] : s;
}

// Product names in the source carry a "#_# " prefix marker. Strip it for display.
export function cleanProductName(raw: unknown): string {
  return String(raw ?? "")
    .replace(/^#_#\s*/, "")
    .trim();
}
