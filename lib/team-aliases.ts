// Maps normalized ESPN team names → normalized streamed.pk team names.
// Add entries here whenever a mismatch is found between the two APIs.
// Keys and values are already normalized (lowercase, alphanumeric only).
//
// Format: "espn_normalized_name": "streamed_normalized_name"
//
// Known mismatches:
const ALIASES: Record<string, string> = {
  "congodr": "drcongo",        // ESPN "Congo DR" vs streamed.pk "DR Congo"
};

export function resolveAlias(normalized: string): string {
  return ALIASES[normalized] ?? normalized;
}
