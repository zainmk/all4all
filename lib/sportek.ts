import { teamKey } from "@/lib/espn";

// The sportek family rotates hosts AND link formats constantly. As of now:
//   • date listings live at total-sportek.st/date/{today,tomorrow}
//   • per-sport race pages live at live.totalsporteki.st/<sport>-streams/
//   • game links are relative + Title-Case: "/Atlanta-Dream-vs-Connecticut-Sun/68571"
//     (previously "https://…/game/atlanta-dream-vs-connecticut-sun/68571/").
// When streams silently vanish, re-check these — the format has changed several
// times. Race category URLs are supplied per league in lib/leagues.ts.
const LISTINGS_BASE = "https://total-sportek.st";

// A relative game link "/<Home>-vs-<Away>/<id>". Group 1 = slug, group 2 = id.
// The "-vs-" plus a trailing numeric id is specific enough to skip blog/nav links.
const LINK_RE = /href="\/([A-Za-z0-9][\w-]*-vs-[\w-]+)\/(\d+)\/?"/g;

/** Absolute game-page URLs found in a listing/category page, against `origin`. */
function extractLinks(html: string, origin: string): Array<{ slug: string; url: string }> {
  const out: Array<{ slug: string; url: string }> = [];
  const re = new RegExp(LINK_RE.source, "g");
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({ slug: m[1], url: `${origin}/${m[1]}/${m[2]}` });
  }
  return out;
}

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
    const res = await fetch(`${LISTINGS_BASE}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) return index;
    const html = await res.text();
    for (const { slug, url } of extractLinks(html, LISTINGS_BASE)) {
      // "Atlanta-Dream-vs-Connecticut-Sun" → home/away (case-insensitive split)
      const vsIdx = slug.toLowerCase().indexOf("-vs-");
      if (vsIdx < 1) continue;
      const home = slugToName(slug.substring(0, vsIdx));
      const away = slugToName(slug.substring(vsIdx + 4));
      index.add(home, away, url);
    }
  } catch { /* scraping failure is non-fatal */ }
  return index;
}

/**
 * Round-slug → stream-page URL from a race-series category page (a full URL like
 * "https://live.totalsporteki.st/motogp-streams/"). The series prefix and the
 * "-vs-Live" suffix are stripped, lower-cased:
 * "MotoGP-Austrian-Grand-Prix-vs-Live" → "austrian-grand-prix". Those pages list
 * the whole calendar without dates, so the caller matches slugs to rounds.
 */
export async function getSportekRaceSlugs(
  categoryUrl: string,
  prefix: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const res = await fetch(categoryUrl, { next: { revalidate: 900 } });
    if (!res.ok) return result;
    const html = await res.text();
    const origin = new URL(categoryUrl).origin;
    const strip = new RegExp(`^${prefix}-`);
    for (const { slug, url } of extractLinks(html, origin)) {
      const round = slug.toLowerCase().replace(strip, "").replace(/-vs-live$/, "");
      if (round && !result.has(round)) result.set(round, url);
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
  categoryUrl: string,
  aliases: Record<string, string>
): Promise<Map<string, string>> {
  const slugs = await getSportekRaceSlugs(categoryUrl, "motogp");
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
