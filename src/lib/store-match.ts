// Shared store-matching logic (used by the seed and by Prime CSV uploads).
// Distinctive token: drop partner prefixes/qualifiers, punctuation, spaces.
//   "HK - Goregaon East" -> "goregaoneast"
export function storeKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\bhihpl\b/g, "")
    .replace(/\b(hk|cz|rebel|cfi|foh|ops|warehouse|outlet)\b/g, "")
    .replace(/bombay sweet shop inventory/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export interface MatchableStore {
  id: string;
  name: string;
  locationAliases: string[];
}

// Match a Prime "Location" string to a store: exact alias first, then fuzzy key.
export function matchStoreToLocation(
  location: string,
  stores: MatchableStore[],
): string | null {
  const loc = location.trim().toLowerCase();
  if (!loc) return null;

  // 1. exact alias match (case-insensitive)
  for (const s of stores) {
    if (s.locationAliases.some((a) => a.trim().toLowerCase() === loc)) return s.id;
  }
  // 2. fuzzy distinctive-key containment
  const k = storeKey(location);
  if (!k) return null;
  const candidates = stores
    .map((s) => ({ id: s.id, key: storeKey(s.name) }))
    .filter((s) => s.key && (s.key === k || s.key.includes(k) || k.includes(s.key)))
    .sort((a, b) => b.key.length - a.key.length);
  return candidates[0]?.id ?? null;
}
