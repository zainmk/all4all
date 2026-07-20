import type {
  ChampionshipStatus,
  MatchSource,
  PodiumEntry,
  RaceEvent,
  RaceResults,
  StandingEntry,
} from "@/types";

// Public API behind motogp.com — no auth.
const API = "https://api.motogp.pulselive.com/motogp/v1";
const BASE = `${API}/results`;

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
interface APISession { id: string; type?: string; number?: number | null }

interface APIClassification {
  position?: number;
  rider?: { full_name?: string; country?: { iso?: string } };
  team?: { name?: string };
  time?: string;
  points?: number;
  /** Qualifying has no `time`; the lap is here instead */
  best_lap?: { time?: string };
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

const NO_RESULTS: RaceResults = { qualifying: [], sprint: [], race: [] };

/** Top three of one session. */
async function topThree(session: APISession | undefined): Promise<PodiumEntry[]> {
  if (!session) return [];
  const result = await getJSON<{ classification?: APIClassification[] }>(
    `${BASE}/session/${session.id}/classification`,
    FINISHED_TTL
  );

  return (result?.classification ?? [])
    .slice(0, 3)
    .map((entry, i) => ({
      position: entry.position ?? i + 1,
      rider: entry.rider?.full_name ?? "",
      team: entry.team?.name ?? "",
      // Leader shows an absolute time (a lap time in qualifying, which has no
      // `time` field); everyone else shows their gap to it.
      time:
        i === 0
          ? entry.time ?? entry.best_lap?.time ?? ""
          : formatGap(entry.gap?.first),
      points: entry.points,
    }))
    .filter((p) => p.rider);
}

function formatGap(gap?: string): string {
  if (!gap) return "";
  return gap.startsWith("+") ? gap : `+${gap}`;
}

/**
 * Qualifying, sprint and race podiums for an event's premier class. Five calls
 * (categories → sessions → three classifications), so it only runs for events
 * that have actually finished — and those results never change, so they're
 * cached for a day.
 */
async function getResults(eventId: string): Promise<RaceResults> {
  const cats = await getJSON<APICategory[]>(
    `${BASE}/categories?eventUuid=${eventId}`,
    FINISHED_TTL
  );
  // "MotoGP™" — match loosely so the trademark glyph can't break it
  const premier = cats?.find((c) => /^motogp/i.test(c.name));
  if (!premier) return NO_RESULTS;

  const sessions = await getJSON<APISession[]>(
    `${BASE}/sessions?eventUuid=${eventId}&categoryUuid=${premier.id}`,
    FINISHED_TTL
  );
  if (!sessions) return NO_RESULTS;

  // Sessions are keyed by type *and* number — qualifying is {type:"Q",number:2},
  // not {type:"Q2"}, while SPR/RAC have a null number.
  const of = (key: string) =>
    sessions.find((s) => `${s.type ?? ""}${s.number ?? ""}` === key);

  const [qualifying, sprint, race] = await Promise.all([
    // Q2 decides the front of the grid; Q1 riders start from P13 back
    topThree(of("Q2")),
    topThree(of("SPR")),
    topThree(of("RAC")),
  ]);

  return { qualifying, sprint, race };
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

  // Only finished rounds need the results lookup
  const results = await Promise.all(
    rounds.map((e) => (isFinished(e) ? getResults(e.id) : Promise.resolve(NO_RESULTS)))
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
    results: results[i],
  }));
}

interface APIStanding {
  position?: number;
  position_change?: number;
  points?: number;
  race_wins?: number;
  podiums?: number;
  sprint_wins?: number;
  last_positions?: Record<string, number | null>;
  rider?: { full_name?: string; number?: number; country?: { iso?: string } };
  team?: { name?: string };
  constructor?: { name?: string };
}

/** Max points a rider can still take from one round: 25 race + 12 sprint. */
const POINTS_PER_ROUND = 37;

/**
 * Riders' championship standings for the premier class, plus the context needed
 * to read them: how far into the season we are, and what's still winnable.
 */
export async function getMotoGPChampionship(
  rounds: Omit<RaceEvent, "sources">[]
): Promise<ChampionshipStatus | null> {
  const season = await currentSeason();
  if (!season) return null;

  const cats = await getJSON<APICategory[]>(
    `${BASE}/categories?seasonUuid=${season.id}`,
    SCHEDULE_TTL
  );
  const premier = cats?.find((c) => /^motogp/i.test(c.name));
  if (!premier) return null;

  const result = await getJSON<{ classification?: APIStanding[] }>(
    `${BASE}/standings?seasonUuid=${season.id}&categoryUuid=${premier.id}`,
    // Standings move after every round, so don't hold them as long as results
    SCHEDULE_TTL
  );
  if (!result?.classification) return null;

  const standings: StandingEntry[] = result.classification
    .map((s, i) => ({
      position: s.position ?? i + 1,
      positionChange: s.position_change ?? 0,
      rider: s.rider?.full_name ?? "",
      riderNumber: s.rider?.number ?? 0,
      countryIso: s.rider?.country?.iso ?? "",
      team: s.team?.name ?? s.constructor?.name ?? "",
      points: s.points ?? 0,
      raceWins: s.race_wins ?? 0,
      podiums: s.podiums ?? 0,
      sprintWins: s.sprint_wins ?? 0,
      // API gives these newest-first; reverse so form reads left to right
      recent: Object.entries(s.last_positions ?? {})
        .map(([round, position]) => ({ round, position }))
        .reverse(),
    }))
    .filter((s) => s.rider);

  const roundsComplete = rounds.filter((r) => r.isFinished).length;
  const next = rounds.find((r) => !r.isFinished);

  return {
    year: season.year,
    roundsComplete,
    roundsTotal: rounds.length,
    nextRound: next ? { name: next.name, dateStart: next.dateStart } : undefined,
    pointsRemaining: (rounds.length - roundsComplete) * POINTS_PER_ROUND,
    standings,
  };
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
