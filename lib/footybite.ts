import type { MatchSource } from "@/types";

const BASE = "https://footybite.ac";

// ESPN display names whose slugs don't follow the simple lowercase-hyphen rule
const SLUG_OVERRIDES: Record<string, string> = {
  "DR Congo": "congo-dr",
  "Congo DR": "congo-dr",
  "United States": "usa",
};

function teamToSlug(name: string): string {
  return SLUG_OVERRIDES[name] ?? name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
}

// "TSN 4 - Link 1 HD" → "tsn"   "bein sports max Arabic - Link 5 HD" → "bein"
function labelToSource(label: string): string {
  return label.split(" - ")[0].trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface FBStream { label: string; type: string; value: string; }

export async function getFootybiteStreams(homeTeam: string, awayTeam: string): Promise<MatchSource[]> {
  const slug = `${teamToSlug(homeTeam)}-vs-${teamToSlug(awayTeam)}`;
  try {
    const res = await fetch(`${BASE}/event/${slug}`, { next: { revalidate: 120 } });
    if (!res.ok) return [];
    const html = await res.text();
    const m = html.match(/const allStreams\s*=\s*(\[[\s\S]*?\]);/);
    if (!m) return [];
    const streams: FBStream[] = JSON.parse(m[1]);
    const KEEP = new Set(["tsn", "fox", "itv1"]);
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
