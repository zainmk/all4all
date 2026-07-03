import type { MatchSource } from "@/types";

const BASE = "https://footybite.ac";

// ESPN display names that can't be derived mechanically from the slug rules.
// Two categories:
//   1. Different naming convention  — "United States" → "usa", "DR Congo" → "congo-dr"
//   2. Slug adds/changes words     — "Bosnia-Herzegovina" → "bosnia-and-herzegovina"
// Add entries here whenever a new mismatch is discovered.
const SLUG_OVERRIDES: Record<string, string> = {
  // United States
  "United States":            "usa",
  // DR Congo (ESPN uses both orderings at different times)
  "DR Congo":                 "congo-dr",
  "Congo DR":                 "congo-dr",
  // Bosnia (ESPN uses hyphen; footybite inserts "and")
  "Bosnia-Herzegovina":       "bosnia-and-herzegovina",
  "Bosnia and Herzegovina":   "bosnia-and-herzegovina",
  // Ivory Coast (ESPN may use French official name)
  "Côte d'Ivoire":            "ivory-coast",
  "Cote d'Ivoire":            "ivory-coast",
  // South Korea
  "South Korea":              "south-korea",
  "Korea Republic":           "south-korea",
  // North Korea
  "Korea DPR":                "north-korea",
  // Saudi Arabia
  "Saudi Arabia":             "saudi-arabia",
  // New Zealand
  "New Zealand":              "new-zealand",
  // South Africa
  "South Africa":             "south-africa",
  // Trinidad & Tobago
  "Trinidad and Tobago":      "trinidad-tobago",
  "Trinidad & Tobago":        "trinidad-tobago",
  // Cape Verde (footybite uses the longer "islands" form)
  "Cape Verde":               "cape-verde-islands",
};

// Fix for category-1 mismatches: treat hyphens as word separators before stripping,
// so "Bosnia-Herzegovina" → "bosnia-herzegovina" (still needs an override for "and",
// but this prevents "bosniaherzegovina" for other hyphenated names we haven't seen yet).
function teamToSlug(name: string): string {
  return (
    SLUG_OVERRIDES[name] ??
    name
      .toLowerCase()
      .replace(/-/g, " ")           // hyphens → spaces (before stripping)
      .replace(/[^a-z0-9\s]/g, "") // strip everything else non-alphanumeric
      .trim()
      .replace(/\s+/g, "-")
  );
}

// "TSN 4 - Link 1 HD" → "tsn"   "BBC One - Link 3 HD" → "bbc"
function labelToSource(label: string): string {
  return label.split(" - ")[0].trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface FBStream { label: string; type: string; value: string; }

// Only the English-language broadcast feeds we want to surface.
const KEEP = new Set(["tsn", "fox", "itv1", "bbc"]);

export async function getFootybiteStreams(homeTeam: string, awayTeam: string): Promise<MatchSource[]> {
  const slug = `${teamToSlug(homeTeam)}-vs-${teamToSlug(awayTeam)}`;
  try {
    const res = await fetch(`${BASE}/event/${slug}`, { next: { revalidate: 120 } });
    if (!res.ok) return [];
    const html = await res.text();
    const m = html.match(/const allStreams\s*=\s*(\[[\s\S]*?\]);/);
    if (!m) return [];
    const streams: FBStream[] = JSON.parse(m[1]);
    return streams
      .filter((s) => s.type === "external" && s.value && KEEP.has(labelToSource(s.label)))
      .map((s, i) => ({
        source: labelToSource(s.label),
        id: `fb-${slug}-${i}`,
        url: s.value,
      }));
  } catch {
    return [];
  }
}
