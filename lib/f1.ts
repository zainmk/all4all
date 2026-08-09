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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch URLs one at a time with a gap between them. jolpica rate-limits bursts
 * (~4 req/s) and its budget is shared/stateful, so even a handful of concurrent
 * requests intermittently 429 — and Next caches those failures for the whole
 * revalidate window, leaving results blank. Serialising with a gap keeps us
 * safely under the limit; the results are cached hard, so this only paces the
 * cold render.
 */
async function fetchSequential<T>(urls: string[], revalidate: number, gapMs = 300): Promise<(T | null)[]> {
  const out: (T | null)[] = [];
  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await sleep(gapMs);
    out.push(await getJSON<T>(urls[i], revalidate));
  }
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

const NO_RESULTS: RaceResults = { qualifying: [], sprint: [], race: [] };

type SessionKind = "race" | "quali";

function toPodium(row: ErgastResult, position: number, kind: SessionKind): PodiumEntry {
  return {
    position,
    rider: fullName(row.Driver),
    team: row.Constructor?.name ?? row.Constructors?.[0]?.name ?? "",
    // Race: winner's total time, others' gap to first. Quali: the pole/relative lap.
    time:
      kind === "quali"
        ? row.Q3 ?? row.Time?.time ?? ""
        : position === 1
          ? row.Time?.time ?? row.status ?? ""
          : formatGap(row.Time?.time),
    points: row.points !== undefined ? Number(row.points) : undefined,
  };
}

/**
 * Ergast can filter a session by finishing position across the whole season, so
 * three calls per session (positions 1–3) return every round's podium — nine
 * calls total, regardless of round count, versus three per finished round. That
 * keeps us well under the rate limit. Returns round → top-three entries.
 */
function assemblePodiums(
  responses: Array<{ MRData: { RaceTable: { Races: ErgastRace[] } } } | null>,
  kind: SessionKind
): Map<string, PodiumEntry[]> {
  const byRound = new Map<string, PodiumEntry[]>();
  // responses[0] = P1, [1] = P2, [2] = P3
  responses.forEach((json, idx) => {
    const position = idx + 1;
    for (const race of json?.MRData.RaceTable.Races ?? []) {
      const row = (race.Results ?? race.QualifyingResults ?? race.SprintResults ?? [])[0];
      if (!row || !row.Driver) continue;
      const entry = toPodium(row, position, kind);
      const arr = byRound.get(race.round) ?? [];
      arr.push(entry);
      byRound.set(race.round, arr);
    }
  });
  for (const arr of byRound.values()) arr.sort((a, b) => a.position - b.position);
  return byRound;
}

async function getSeasonPodiums(season: string): Promise<Map<string, RaceResults>> {
  // Nine URLs: {race,qualifying,sprint} × positions 1–3, each returning all rounds
  const urls: string[] = [];
  for (const type of ["results", "qualifying", "sprint"]) {
    for (const pos of [1, 2, 3]) {
      urls.push(`${BASE}/${season}/${type}/${pos}.json?limit=100`);
    }
  }
  type RaceJson = { MRData: { RaceTable: { Races: ErgastRace[] } } };
  const r = await fetchSequential<RaceJson>(urls, FINISHED_TTL);

  const race = assemblePodiums(r.slice(0, 3), "race");
  const qualifying = assemblePodiums(r.slice(3, 6), "quali");
  const sprint = assemblePodiums(r.slice(6, 9), "race");

  const rounds = new Set<string>([...race.keys(), ...qualifying.keys(), ...sprint.keys()]);
  const map = new Map<string, RaceResults>();
  for (const round of rounds) {
    map.set(round, {
      race: race.get(round) ?? [],
      qualifying: qualifying.get(round) ?? [],
      sprint: sprint.get(round) ?? [],
    });
  }
  return map;
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

  // One season-wide fetch (9 calls) covers every round's podiums
  const podiums = await getSeasonPodiums(season);

  return withTimes.map(({ r, raceMs, startMs, finished }, i) => {
    const loc = r.Circuit?.Location;
    return {
      id: `f1-${season}-${r.round}`,
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
      results: podiums.get(r.round) ?? NO_RESULTS,
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
