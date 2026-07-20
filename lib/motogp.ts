import type { MatchSource, PodiumEntry, RaceEvent } from "@/types";

// Public API behind motogp.com — no auth.
const BASE = "https://api.motogp.pulselive.com/motogp/v1/results";

// Results for a finished race never change, so they can be cached hard.
const FINISHED_TTL = 86_400;
const SCHEDULE_TTL = 3_600;

interface APISeason { id: string; year: number; current?: boolean }

interface APIEvent {
  id: string;
  name: string;
  short_name: string;
  sponsored_name?: string;
  test?: boolean;
  status?: string;
  date_start?: string;
  date_end?: string;
  country?: { iso?: string; name?: string };
  circuit?: { name?: string; place?: string; nation?: string };
}

interface APICategory { id: string; name: string }
interface APISession { id: string; type?: string; number?: number }

interface APIClassification {
  position?: number;
  rider?: { full_name?: string; country?: { iso?: string } };
  team?: { name?: string };
  time?: string;
  gap?: { first?: string };
}

async function getJSON<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** The season to show — the API's current flag, else the latest year. */
async function currentSeason(): Promise<APISeason | null> {
  const seasons = await getJSON<APISeason[]>(`${BASE}/seasons`, SCHEDULE_TTL);
  if (!seasons || seasons.length === 0) return null;
  return (
    seasons.find((s) => s.current) ??
    seasons.reduce((a, b) => (b.year > a.year ? b : a))
  );
}

/**
 * Podium for an event's premier-class race. Three chained calls
 * (categories → sessions → classification), so it's only worth doing
 * for events that have actually finished.
 */
async function getPodium(eventId: string): Promise<PodiumEntry[]> {
  const cats = await getJSON<APICategory[]>(
    `${BASE}/categories?eventUuid=${eventId}`,
    FINISHED_TTL
  );
  // "MotoGP™" — match loosely so the trademark glyph can't break it
  const premier = cats?.find((c) => /^motogp/i.test(c.name));
  if (!premier) return [];

  const sessions = await getJSON<APISession[]>(
    `${BASE}/sessions?eventUuid=${eventId}&categoryUuid=${premier.id}`,
    FINISHED_TTL
  );
  const race = sessions?.find((s) => s.type === "RAC");
  if (!race) return [];

  const result = await getJSON<{ classification?: APIClassification[] }>(
    `${BASE}/session/${race.id}/classification`,
    FINISHED_TTL
  );

  return (result?.classification ?? [])
    .slice(0, 3)
    .map((entry, i) => ({
      position: entry.position ?? i + 1,
      rider: entry.rider?.full_name ?? "",
      team: entry.team?.name ?? "",
      // Winner has an absolute time; everyone else has a gap to first
      time: (i === 0 ? entry.time : entry.gap?.first) ?? "",
    }))
    .filter((p) => p.rider);
}

function isFinished(event: APIEvent): boolean {
  return (event.status ?? "").toUpperCase() === "FINISHED";
}

/**
 * The full season calendar, oldest first, with podiums attached to
 * finished rounds. `sources` is left empty for the caller to fill in.
 */
export async function getMotoGPSeason(): Promise<Omit<RaceEvent, "sources">[]> {
  const season = await currentSeason();
  if (!season) return [];

  const events = await getJSON<APIEvent[]>(
    `${BASE}/events?seasonUuid=${season.id}`,
    SCHEDULE_TTL
  );
  if (!events) return [];

  const rounds = events
    .filter((e) => !e.test && e.date_start)
    .sort((a, b) => Date.parse(a.date_start!) - Date.parse(b.date_start!));

  // Only finished rounds need the three-call podium lookup
  const podiums = await Promise.all(
    rounds.map((e) => (isFinished(e) ? getPodium(e.id) : Promise.resolve([])))
  );

  return rounds.map((e, i) => ({
    id: e.id,
    name: titleCase(e.name),
    shortName: e.short_name,
    countryIso: e.country?.iso ?? "",
    circuit: e.circuit?.name ?? "",
    place: e.circuit?.place ?? "",
    dateStart: Date.parse(e.date_start!),
    dateEnd: e.date_end ? Date.parse(e.date_end) : Date.parse(e.date_start!),
    isFinished: isFinished(e),
    round: i + 1,
    podium: podiums[i],
  }));
}

// The API shouts event names ("GRAND PRIX OF GERMANY").
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => (w === "of" || w === "the" || w === "de" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * sportek names rounds by demonym ("motogp-british-grand-prix") while the API
 * uses the country ("GRAND PRIX OF GREAT BRITAIN"), so the two can't be matched
 * mechanically. Maps the distinctive slug token → the API's `short_name`.
 * Add an entry here when a new round appears unmatched.
 */
export const SPORTEK_ROUND_ALIASES: Record<string, string> = {
  thai: "THA", thailand: "THA",
  brazilian: "BRA", brazil: "BRA",
  americas: "USA", "united-states": "USA", american: "USA",
  spanish: "SPA", spain: "SPA", jerez: "SPA",
  french: "FRA", france: "FRA",
  catalan: "CAT", catalunya: "CAT", catalonia: "CAT",
  italian: "ITA", italy: "ITA", mugello: "ITA",
  hungarian: "HUN", hungary: "HUN",
  czech: "CZE", czechia: "CZE", brno: "CZE",
  dutch: "NED", netherlands: "NED", assen: "NED",
  german: "GER", germany: "GER",
  british: "GBR", "great-britain": "GBR", silverstone: "GBR",
  aragon: "ARA",
  "san-marino": "RSM", misano: "RSM",
  austrian: "AUT", austria: "AUT",
  japanese: "JPN", japan: "JPN", motegi: "JPN",
  indonesian: "INA", indonesia: "INA", mandalika: "INA",
  australian: "AUS", australia: "AUS",
  malaysian: "MAL", malaysia: "MAL", sepang: "MAL",
  qatar: "QAT", qatari: "QAT", lusail: "QAT",
  portuguese: "POR", portugal: "POR", algarve: "POR",
  valencia: "VAL", valencian: "VAL",
};

/** Attach a sportek stream URL to a round, if the index has one. */
export function sourcesForRound(
  shortName: string,
  urlsByShortName: Map<string, string>
): MatchSource[] {
  const url = urlsByShortName.get(shortName);
  return url ? [{ source: "sportek", id: `sportek-motogp-${shortName}`, url }] : [];
}
