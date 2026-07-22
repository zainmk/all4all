import { teamKey } from "@/lib/espn";

const BASE = "https://totalsportekx.is";

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

// Sportek sometimes lists a team by nickname only ("wings-vs-liberty" for
// Dallas Wings vs New York Liberty). Indexing games under a nickname key too
// lets those still resolve.
function nickname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export interface SportekIndex {
  /** Sportek game page URL for this pairing, if one was listed. */
  find(home: string, away: string): string | undefined;
}

class Index implements SportekIndex {
  private full = new Map<string, string>();
  private nick = new Map<string, string>();
  private nickCollisions = new Set<string>();

  add(home: string, away: string, url: string) {
    const key = teamKey(home, away);
    if (!this.full.has(key)) this.full.set(key, url);

    const nk = teamKey(nickname(home), nickname(away));
    if (nk === key) return; // both sides were single-word; nothing extra to index
    if (this.nick.has(nk) && this.nick.get(nk) !== url) {
      // Ambiguous nickname (e.g. "wings" across two leagues) — don't guess.
      this.nickCollisions.add(nk);
      return;
    }
    this.nick.set(nk, url);
  }

  /** Merge another index in, with `this` taking priority. */
  mergeUnder(other: Index) {
    for (const [k, v] of other.full) if (!this.full.has(k)) this.full.set(k, v);
    for (const [k, v] of other.nick) if (!this.nick.has(k)) this.nick.set(k, v);
    for (const k of other.nickCollisions) this.nickCollisions.add(k);
  }

  private nickGet(key: string): string | undefined {
    return this.nickCollisions.has(key) ? undefined : this.nick.get(key);
  }

  find(home: string, away: string): string | undefined {
    // Exact pairing first, then the reverse (sportek and ESPN don't always
    // agree on which side is "home"), then the same two passes on nicknames.
    return (
      this.full.get(teamKey(home, away)) ??
      this.full.get(teamKey(away, home)) ??
      this.nickGet(teamKey(nickname(home), nickname(away))) ??
      this.nickGet(teamKey(nickname(away), nickname(home)))
    );
  }
}

async function fetchMatchUrls(path: string): Promise<Index> {
  const index = new Index();
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) return index;
    const html = await res.text();
    const re = /href="(https:\/\/totalsportekx\.is\/game\/([^/"]+)\/\d+\/?)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const url = m[1];
      const slug = m[2];
      const vsIdx = slug.indexOf("-vs-");
      if (vsIdx < 1) continue;
      const home = slugToName(slug.substring(0, vsIdx));
      const away = slugToName(slug.substring(vsIdx + 4));
      index.add(home, away, url);
    }
  } catch { /* scraping failure is non-fatal */ }
  return index;
}

/**
 * Raw stream-page URLs from a race-series category page (e.g. "/f1-stream/"),
 * keyed by the round slug with the series prefix and "-vs-live" stripped
 * ("f1-hungarian-grand-prix-vs-live" → "hungarian-grand-prix"). Those pages
 * list the whole calendar without dates, so the caller matches slugs to rounds.
 */
export async function getSportekRaceSlugs(
  path: string,
  prefix: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: 900 } });
    if (!res.ok) return result;
    const html = await res.text();
    const re = /href="(https:\/\/totalsportek[a-z0-9]*\.is\/game\/([^/"]+)\/\d+\/?)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const url = m[1];
      const slug = m[2].replace(new RegExp(`^${prefix}-`), "").replace(/-vs-live$/, "");
      if (slug && !result.has(slug)) result.set(slug, url);
    }
  } catch { /* scraping failure is non-fatal */ }
  return result;
}

/**
 * MotoGP variant: resolves each slug to the API's short_name ("GBR") via an
 * alias table, since sportek's demonym ("british") doesn't match the API's
 * country ("GRAND PRIX OF GREAT BRITAIN").
 */
export async function getSportekRaceIndex(
  path: string,
  aliases: Record<string, string>
): Promise<Map<string, string>> {
  const slugs = await getSportekRaceSlugs(path, "motogp");
  const result = new Map<string, string>();
  for (const [slug, url] of slugs) {
    const round = aliases[slug] ?? aliases[slug.replace(/-grand-prix$/, "")];
    if (round && !result.has(round)) result.set(round, url);
  }
  return result;
}

// Index of today's and tomorrow's sportek game pages, across all sports.
export async function getSportekIndex(): Promise<SportekIndex> {
  const [today, tomorrow] = await Promise.all([
    fetchMatchUrls("/date/today"),
    fetchMatchUrls("/date/tomorrow"),
  ]);
  // today takes priority over tomorrow for the same key
  today.mergeUnder(tomorrow);
  return today;
}
