// Maps normalized ESPN team names → the normalized name a stream source uses,
// so teamKey() lines the two up. Applied to both sides of every comparison.
// Add entries here whenever a mismatch is found.
// Keys and values are already normalized (lowercase, alphanumeric only).
//
// Format: "espn_normalized_name": "source_normalized_name"
//
// Known mismatches:
const ALIASES: Record<string, string> = {
  "laclippers": "losangelesclippers", // ESPN "LA Clippers" vs "Los Angeles Clippers"
};

export function resolveAlias(normalized: string): string {
  return ALIASES[normalized] ?? normalized;
}
