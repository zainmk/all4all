import type {
  ChampionshipStatus,
  MatchSource,
  PodiumEntry,
  RaceEvent,
  RaceResults,
  StandingEntry,
} from "@/types";
import { getSportekRaceSlugs } from "@/lib/sportek";

// jolpica — the community-run Ergast successor. Free, no auth.
const BASE = "https://api.jolpi.ca/ergast/f1";

const FINISHED_TTL = 86_400; // results never change
const SCHEDULE_TTL = 3_600;

async function getJSON<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Run `fn` over `items` at most `limit` at a time. jolpica rate-limits bursts
 * (~4 req/s), and a full season's results is dozens of calls, so firing them
 * all at once gets many 429s. Results are cached hard, so this only paces the
 * cold render.
 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

interface ErgastDriver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  givenName: string;
  familyName: string;
}
interface ErgastConstructor { name: string }
interface ErgastLocation { country?: string; locality?: string }
interface ErgastCircuit { circuitName?: string; Location?: ErgastLocation }
interface ErgastSession { date?: string; time?: string }
interface ErgastRace {
  season?: string;
  round: string;
  raceName: string;
  date?: string;
  time?: string;
  Circuit?: ErgastCircuit;
  FirstPractice?: ErgastSession;
  Sprint?: ErgastSession;
  Results?: ErgastResult[];
  QualifyingResults?: ErgastResult[];
  SprintResults?: ErgastResult[];
}
interface ErgastResult {
  position?: string;
  points?: string;
  grid?: string;
  Driver?: ErgastDriver;
  Constructor?: ErgastConstructor;
  Constructors?: ErgastConstructor[];
  Time?: { time?: string };
  Q3?: string;
  status?: string;
}
interface ErgastStanding {
  position?: string;
  points?: string;
  wins?: string;
  Driver?: ErgastDriver;
  Constructors?: ErgastConstructor[];
}

// jolpica reports nationalities/circuits by country name; flagcdn wants ISO2.
const COUNTRY_ISO: Record<string, string> = {
  Australia: "au", China: "cn", Japan: "jp", USA: "us", "United States": "us",
  Canada: "ca", Monaco: "mc", Spain: "es", Austria: "at", UK: "gb",
  "United Kingdom": "gb", Belgium: "be", Hungary: "hu", Netherlands: "nl",
  Italy: "it", Azerbaijan: "az", Singapore: "sg", Mexico: "mx", Brazil: "br",
  Qatar: "qa", UAE: "ae", "United Arab Emirates": "ae", "Saudi Arabia": "sa",
  Bahrain: "bh", France: "fr", Germany: "de", Portugal: "pt", "South Africa": "za",
};

function isoFor(country?: string): string {
  return COUNTRY_ISO[country ?? ""] ?? "";
}

function fullName(d?: ErgastDriver): string {
  return d ? `${d.givenName} ${d.familyName}`.trim() : "";
}

function formatGap(time?: string): string {
  if (!time) return "";
  return time.startsWith("+") ? time : `+${time}`;
}

/** Top three of one session's result rows. */
function topThree(rows: ErgastResult[] | undefined, kind: "race" | "quali"): PodiumEntry[] {
  return (rows ?? [])
    .slice(0, 3)
    .map((r, i) => ({
      position: parseInt(r.position ?? "", 10) || i + 1,
      rider: fullName(r.Driver),
      team: r.Constructor?.name ?? r.Constructors?.[0]?.name ?? "",
      // Race: winner's total time, others' gap. Quali: the pole/relative lap.
      time:
        kind === "quali"
          ? r.Q3 ?? r.Time?.time ?? ""
          : i === 0
            ? r.Time?.time ?? r.status ?? ""
            : formatGap(r.Time?.time),
      points: r.points !== undefined ? Number(r.points) : undefined,
    }))
    .filter((p) => p.rider);
}

const NO_RESULTS: RaceResults = { qualifying: [], sprint: [], race: [] };

/** Qualifying, (optional) sprint and race podiums for one finished round. */
async function getResults(season: string, round: string, hasSprint: boolean): Promise<RaceResults> {
  const one = (path: string) =>
    getJSON<{ MRData: { RaceTable: { Races: ErgastRace[] } } }>(
      `${BASE}/${season}/${round}/${path}.json`,
      FINISHED_TTL
    );

  const [raceJ, qualiJ, sprintJ] = await Promise.all([
    one("results"),
    one("qualifying"),
    hasSprint ? one("sprint") : Promise.resolve(null),
  ]);

  const race = raceJ?.MRData.RaceTable.Races[0]?.Results;
  const quali = qualiJ?.MRData.RaceTable.Races[0]?.QualifyingResults;
  const sprint = sprintJ?.MRData.RaceTable.Races[0]?.SprintResults;

  return {
    qualifying: topThree(quali, "quali"),
    sprint: topThree(sprint, "race"),
    race: topThree(race, "race"),
  };
}

/** The full season calendar, oldest first, with podiums on finished rounds. */
export async function getF1Season(): Promise<Omit<RaceEvent, "sources">[]> {
  const schedule = await getJSON<{ MRData: { RaceTable: { season?: string; Races: ErgastRace[] } } }>(
    `${BASE}/current.json`,
    SCHEDULE_TTL
  );
  const races = schedule?.MRData.RaceTable.Races ?? [];
  if (races.length === 0) return [];
  const season = schedule?.MRData.RaceTable.season ?? races[0].season ?? "";

  const now = Date.now();
  const withTimes = races.map((r) => {
    const raceMs = Date.parse(`${r.date}T${r.time ?? "13:00:00Z"}`);
    // Weekend opens at first practice; treat "finished" as ~4h after lights out
    const startMs = r.FirstPractice?.date
      ? Date.parse(`${r.FirstPractice.date}T${r.FirstPractice.time ?? "09:00:00Z"}`)
      : raceMs;
    return { r, raceMs, startMs, finished: now > raceMs + 4 * 3_600_000 };
  });

  // Paced to stay under jolpica's burst limit — each finished round is up to
  // three calls, so 3 rounds at a time is ~9 in flight.
  const results = await mapLimit(withTimes, 3, ({ r, finished }) =>
    finished ? getResults(season, r.round, !!r.Sprint) : Promise.resolve(NO_RESULTS)
  );

  return withTimes.map(({ r, raceMs, startMs, finished }, i) => {
    const loc = r.Circuit?.Location;
    return {
      id: `f1-2026-${r.round}`,
      name: r.raceName,
      // Slug used both as the DOM id and to match sportek stream links
      shortName: sportekSlug(r.raceName),
      countryIso: isoFor(loc?.country),
      circuit: r.Circuit?.circuitName ?? "",
      place: loc?.locality ?? "",
      dateStart: startMs,
      dateEnd: raceMs,
      // jolpica's race datetime already carries the lights-out time of day
      raceStart: raceMs,
      isFinished: finished,
      round: parseInt(r.round, 10) || i + 1,
      results: results[i],
    };
  });
}

/** "Hungarian Grand Prix" → "hungarian-grand-prix" (sportek's slug form). */
function sportekSlug(raceName: string): string {
  return raceName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// A few sportek slugs don't match the mechanical form of the race name.
const SPORTEK_SLUG_OVERRIDES: Record<string, string> = {
  // jolpica "Italian Grand Prix" vs sportek "f1-italy-grand-prix"
  "italian-grand-prix": "italy-grand-prix",
  // jolpica "Brazilian Grand Prix" (São Paulo) vs sportek "f1-sao-paulo-grand-prix"
  "brazilian-grand-prix": "sao-paulo-grand-prix",
};

/** Attach a sportek stream URL to each upcoming round. */
export async function attachF1Sources(
  rounds: Omit<RaceEvent, "sources">[],
  sportekPath: string
): Promise<RaceEvent[]> {
  const slugs = await getSportekRaceSlugs(sportekPath, "f1");
  return rounds.map((r) => {
    const url = slugs.get(r.shortName) ?? slugs.get(SPORTEK_SLUG_OVERRIDES[r.shortName] ?? "");
    return {
      ...r,
      sources: url ? [{ source: "sportek", id: `sportek-f1-${r.shortName}`, url } as MatchSource] : [],
    };
  });
}

/** Race win is 25 points; used only for the (non-displayed) points-remaining figure. */
const RACE_POINTS = 25;

/**
 * Drivers' championship, plus the season context. Movement since the last round
 * is computed by diffing the two most recent standings snapshots, since the API
 * doesn't report it directly.
 */
export async function getF1Championship(
  rounds: Omit<RaceEvent, "sources">[]
): Promise<ChampionshipStatus | null> {
  const latest = await getJSON<{
    MRData: { StandingsTable: { season?: string; round?: string; StandingsLists: Array<{ season?: string; round?: string; DriverStandings?: ErgastStanding[] }> } };
  }>(`${BASE}/current/driverStandings.json`, SCHEDULE_TTL);

  const table = latest?.MRData.StandingsTable;
  const list = table?.StandingsLists[0];
  const rows = list?.DriverStandings;
  if (!rows || rows.length === 0) return null;

  const season = table?.season ?? list?.season ?? "";
  const year = Number(season) || new Date().getFullYear();

  // Previous round's order, to work out who moved
  const currentRound = parseInt(table?.round ?? list?.round ?? "0", 10);
  const prevRankById = new Map<string, number>();
  if (currentRound > 1 && season) {
    const prev = await getJSON<{
      MRData: { StandingsTable: { StandingsLists: Array<{ DriverStandings?: ErgastStanding[] }> } };
    }>(`${BASE}/${season}/${currentRound - 1}/driverStandings.json`, FINISHED_TTL);
    for (const s of prev?.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []) {
      if (s.Driver?.driverId) prevRankById.set(s.Driver.driverId, parseInt(s.position ?? "0", 10));
    }
  }

  const standings: StandingEntry[] = rows
    .map((s) => {
      const position = parseInt(s.position ?? "0", 10);
      const prev = s.Driver?.driverId ? prevRankById.get(s.Driver.driverId) : undefined;
      return {
        position,
        // Rank improves as the number falls, so prev − current is places gained
        positionChange: prev ? prev - position : 0,
        rider: fullName(s.Driver),
        riderNumber: s.Driver?.permanentNumber ? Number(s.Driver.permanentNumber) : 0,
        countryIso: "",
        team: s.Constructors?.[0]?.name ?? "",
        points: Number(s.points ?? 0),
        raceWins: Number(s.wins ?? 0),
        // jolpica doesn't aggregate podiums/sprint wins/recent form
      };
    })
    .filter((s) => s.rider);

  const roundsComplete = rounds.filter((r) => r.isFinished).length;
  const next = rounds.find((r) => !r.isFinished);

  return {
    year,
    roundsComplete,
    roundsTotal: rounds.length,
    nextRound: next ? { name: next.name, dateStart: next.dateStart } : undefined,
    pointsRemaining: (rounds.length - roundsComplete) * RACE_POINTS,
    standings,
  };
}
