// Locality synonyms: names we use vs. what Prime/ERPNext call the same place.
// The first token is canonical; every other token folds into it before matching,
// so "Powai" (Prime) and "Vikhroli" (our name) resolve to the same store.
const STORE_SYNONYMS: string[][] = [["powai", "vikhroli"]];

// Shared store-matching logic (used by the seed and by Prime CSV uploads).
// Distinctive token: drop partner prefixes/qualifiers, punctuation, spaces.
//   "HK - Goregaon East" -> "goregaoneast"
export function storeKey(label: string): string {
  let key = label
    .toLowerCase()
    .replace(/\bhihpl\b/g, "")
    .replace(/\b(hk|cz|rebel|cfi|foh|ops|warehouse|outlet)\b/g, "")
    .replace(/bombay sweet shop inventory/g, "")
    .replace(/[^a-z0-9]/g, "");
  // fold each synonym group down to its canonical token
  for (const group of STORE_SYNONYMS) {
    const [canon, ...rest] = group;
    for (const term of rest) key = key.split(term).join(canon);
  }
  return key;
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
