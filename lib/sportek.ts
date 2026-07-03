import { teamKey } from "@/lib/espn";

const BASE = "https://live.totalsportek.christmas";

// Sportek slugs use different names than ESPN in some cases.
// Map sportek display name → ESPN display name so teamKey() matches.
// Add entries here when a mismatch is discovered.
const NAME_MAP: Record<string, string> = {
  "Cape Verde Islands": "Cape Verde",
  "Ivory Coast":        "Côte d'Ivoire",
  "USA":                "United States",
  "Korea Republic":     "South Korea",
  "Korea DPR":          "North Korea",
  "DR Congo":           "Congo DR",
};

function slugToName(slug: string): string {
  const name = slug.replace(/-/g, " ");
  return NAME_MAP[name] ?? name;
}

async function fetchMatchUrls(path: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) return result;
    const html = await res.text();
    const re = /href="(https:\/\/live\.totalsportek\.christmas\/([^/"]+)\/\d+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const url = m[1];
      const slug = m[2];
      const vsIdx = slug.indexOf("-vs-");
      if (vsIdx < 1) continue;
      const home = slugToName(slug.substring(0, vsIdx));
      const away = slugToName(slug.substring(vsIdx + 4));
      const key = teamKey(home, away);
      if (!result.has(key)) result.set(key, url);
    }
  } catch { /* scraping failure is non-fatal */ }
  return result;
}

// Returns teamKey → sportek match page URL for today and tomorrow's matches.
export async function getSportekMatchUrls(): Promise<Map<string, string>> {
  const [today, tomorrow] = await Promise.all([
    fetchMatchUrls("/date/today"),
    fetchMatchUrls("/date/tomorrow"),
  ]);
  // today takes priority over tomorrow for the same key
  return new Map([...tomorrow, ...today]);
}
