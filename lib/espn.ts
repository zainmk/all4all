import type {
  BracketSeries,
  BracketTeam,
  ESPNMatch,
  GoalEvent,
  PlayoffBracket,
  TeamStanding,
  TeamStandingsData,
} from "@/types";
import type { TeamLeagueConfig } from "@/lib/leagues";
import { resolveAlias } from "@/lib/team-aliases";

// ESPN public scoreboard API — no auth, no CORS issues
function scoreboardUrl(league: TeamLeagueConfig): string {
  return `https://site.api.espn.com/apis/site/v2/sports/${league.espnPath}/scoreboard`;
}

interface ESPNAddress {
  city?: string;
  state?: string;
  country?: string;
}

interface ESPNCompetitor {
  homeAway: "home" | "away";
  score?: string;
  winner?: boolean;
  team: { id?: string; displayName: string; logo?: string };
}

interface ESPNDetail {
  scoringPlay?: boolean;
  type?: { id?: string; text?: string };
  clock?: { displayValue?: string };
  team?: { id?: string };
  athletesInvolved?: Array<{ displayName?: string }>;
}

interface ESPNEvent {
  id?: string;
  date?: string;
  status?: { displayClock?: string; type?: { name?: string; shortDetail?: string } };
  competitions?: Array<{
    competitors?: ESPNCompetitor[];
    venue?: { fullName?: string; address?: ESPNAddress };
    details?: ESPNDetail[];
  }>;
}

function lastName(full: string): string {
  const parts = full.trim().split(" ");
  return parts[parts.length - 1];
}

function normalize(name: string): string {
  return resolveAlias(
    name.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip combining diacritics (é->e, í->i, etc.)
      // streamed.pk suffixes women's teams with a standalone " W" ("Dallas Wings W")
      .replace(/\s+w$/, '')
      .replace(/[^a-z0-9]/g, '')
  );
}

export function teamKey(home: string, away: string): string {
  return `${normalize(home)}_${normalize(away)}`;
}

function espnDateStr(ms: number): string {
  // ESPN wants YYYYMMDD
  return new Date(ms).toISOString().split("T")[0].replace(/-/g, "");
}

function isFinishedStatus(statusName: string): boolean {
  return (
    statusName === "STATUS_FULL_TIME" ||
    statusName === "STATUS_FINAL" ||
    statusName === "STATUS_FINAL_PEN" ||
    statusName === "STATUS_FINAL_AET" ||
    statusName === "STATUS_FINAL_OT"
  );
}

// Parse ESPN displayClock into total elapsed minutes.
// "90'+7'" → 97, "120'+5'" → 125, "90:00" → 90, "120'" → 120.
function parseMatchMinutes(displayClock: string | undefined, fallback: number): number {
  if (!displayClock) return fallback;
  const withInjury = displayClock.match(/^(\d+)'\+(\d+)'/);
  if (withInjury) return parseInt(withInjury[1]) + parseInt(withInjury[2]);
  const colon = displayClock.match(/^(\d+):/);
  if (colon) return parseInt(colon[1]);
  const bare = displayClock.match(/^(\d+)'$/);
  if (bare) return parseInt(bare[1]);
  return fallback;
}

export async function getESPNMatchRange(
  league: TeamLeagueConfig,
  daysBack: number,
  daysAhead: number
): Promise<Omit<ESPNMatch, "sources">[]> {
  const now = Date.now();

  // Fetch each day individually rather than as a `dates=START-END` range: ESPN's
  // range query silently returns nothing in the postseason (season type 3), while
  // single-day queries work year-round. One call per day in the window, merged.
  const days: string[] = [];
  for (let off = -daysBack; off <= daysAhead; off++) {
    days.push(espnDateStr(now + off * 86_400_000));
  }

  const perDay = await Promise.all(
    days.map(async (day) => {
      try {
        const res = await fetch(`${scoreboardUrl(league)}?dates=${day}&limit=100`, {
          next: { revalidate: 30 },
        });
        if (!res.ok) return [] as ESPNEvent[];
        const data = await res.json();
        return (data.events ?? []) as ESPNEvent[];
      } catch {
        return [] as ESPNEvent[]; // a single day's failure shouldn't drop the rest
      }
    })
  );
  const events: ESPNEvent[] = perDay.flat();

  const results: Omit<ESPNMatch, "sources">[] = [];
  const seenIds = new Set<string>();

  for (const event of events) {
    if (!event.id || seenIds.has(event.id)) continue;
    seenIds.add(event.id);

    const comp = event.competitions?.[0];
    if (!comp) continue;

    const competitors = comp.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const statusName = event.status?.type?.name ?? "";
    const finished = isFinishedStatus(statusName);
    const postponed =
      statusName === "STATUS_POSTPONED" ||
      statusName === "STATUS_CANCELED" ||
      statusName === "STATUS_SUSPENDED";
    const isLive =
      !finished && !postponed && statusName !== "" && statusName !== "STATUS_SCHEDULED";
    const hasScore =
      !postponed &&
      statusName !== "STATUS_SCHEDULED" &&
      statusName !== "" &&
      home.score !== undefined &&
      away.score !== undefined;

    const venue = comp.venue;
    const city = venue?.address?.city;
    const region = venue?.address?.state ?? venue?.address?.country;
    const shortDetail = event.status?.type?.shortDetail;

    let hideAfterMs: number | undefined;
    if (finished && event.date) {
      const kickoffMs = new Date(event.date).getTime();
      const elapsedMs =
        league.detail === "goals"
          ? parseMatchMinutes(event.status?.displayClock, league.typicalDurationMins) * 60_000
          : league.typicalDurationMins * 60_000;
      hideAfterMs = kickoffMs + elapsedMs + 30 * 60_000;
    }

    const homeId = home.team.id;
    // Only filter penalty-type plays for shootout matches; in regular play a penalty kick is a real goal
    const isPenaltyShootout = statusName === "STATUS_FINAL_PEN";
    const goals: GoalEvent[] =
      league.detail !== "goals"
        ? []
        : (comp.details ?? [])
            .filter((d) => d.scoringPlay && !(isPenaltyShootout && d.type?.text?.toLowerCase().includes("penalty")))
            .map((d) => ({
              scorer: lastName(d.athletesInvolved?.[0]?.displayName ?? ""),
              minute: d.clock?.displayValue ?? "",
              team: (d.team?.id === homeId ? "home" : "away") as "home" | "away",
            }))
            .filter((g) => g.scorer);

    results.push({
      id: event.id,
      date: event.date ? new Date(event.date).getTime() : 0,
      homeTeam: { name: home.team.displayName, logo: home.team.logo, winner: home.winner },
      awayTeam: { name: away.team.displayName, logo: away.team.logo, winner: away.winner },
      score: hasScore
        ? { home: parseInt(home.score!, 10), away: parseInt(away.score!, 10) }
        : undefined,
      clock: isLive && shortDetail ? shortDetail : undefined,
      venue: venue?.fullName
        ? { stadium: venue.fullName, city: city ?? "", country: region ?? "" }
        : undefined,
      isFinished: finished,
      isLive,
      isPostponed: postponed,
      matchTime: finished ? (shortDetail ?? "FT") : undefined,
      hideAfterMs,
      goals,
    });
  }

  return results.sort((a, b) => a.date - b.date);
}

// ── Standings ────────────────────────────────────────────────────────────────

interface ESPNStat { name?: string; displayValue?: string; value?: number }
interface ESPNStandingEntry {
  team: { displayName: string; abbreviation?: string; logos?: Array<{ href?: string }> };
  stats: ESPNStat[];
}
interface ESPNStandingGroup {
  name?: string;
  standings?: { entries?: ESPNStandingEntry[] };
}
interface ESPNStandingsResponse {
  season?: { year?: number };
  children?: ESPNStandingGroup[];
}

function statValue(stats: ESPNStat[], name: string): string {
  return stats.find((s) => s.name === name)?.displayValue ?? "";
}
function statNum(stats: ESPNStat[], name: string): number {
  return stats.find((s) => s.name === name)?.value ?? 0;
}

/**
 * Conference standings for a league, from ESPN's public standings API. Returns
 * null when the league has no such table (e.g. a knockout tournament) or the
 * request fails.
 */
export async function getStandings(
  league: TeamLeagueConfig
): Promise<TeamStandingsData | null> {
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/v2/sports/${league.espnPath}/standings`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as ESPNStandingsResponse;

    const conferences = (data.children ?? [])
      .map((group) => ({
        name: group.name ?? "",
        teams: (group.standings?.entries ?? [])
          .map((e): TeamStanding => ({
            seed: statNum(e.stats, "playoffSeed"),
            team: e.team.displayName,
            abbrev: e.team.abbreviation ?? "",
            logo: e.team.logos?.[0]?.href,
            wins: statNum(e.stats, "wins"),
            losses: statNum(e.stats, "losses"),
            winPct: statValue(e.stats, "winPercent"),
            gamesBehind: statValue(e.stats, "gamesBehind"),
            streak: statValue(e.stats, "streak"),
            lastTen: statValue(e.stats, "Last Ten Games"),
          }))
          // Fall back to record order if seed isn't populated yet
          .sort((a, b) => (a.seed || 99) - (b.seed || 99) || b.wins - a.wins),
      }))
      .filter((c) => c.teams.length > 0);

    if (conferences.length === 0) return null;

    // Western conference on the left
    conferences.sort((a, b) => Number(/west/i.test(b.name)) - Number(/west/i.test(a.name)));

    const year = data.season?.year ?? new Date().getFullYear();
    return { title: `${year} Standings`, conferences };
  } catch {
    return null;
  }
}

// ── Playoff bracket ──────────────────────────────────────────────────────────

interface ESPNSeriesCompetitor { id?: string; wins?: number }
interface ESPNSeries {
  type?: string;
  summary?: string;
  completed?: boolean;
  totalCompetitions?: number;
  competitors?: ESPNSeriesCompetitor[];
}
interface ESPNScoreTeam {
  id?: string;
  abbreviation?: string;
  displayName?: string;
  logo?: string;
}
interface ESPNScoreEvent {
  competitions?: Array<{
    series?: ESPNSeries;
    competitors?: Array<{ team: ESPNScoreTeam }>;
  }>;
}

// Round of a series, by its length: best-of-3 first round, -5 semis, -7 finals.
function roundOf(bestOf: number): BracketSeries["round"] {
  return bestOf >= 7 ? "final" : bestOf >= 5 ? "semi" : "first";
}

function isTbd(t: ESPNScoreTeam): boolean {
  return !t.id || !t.abbreviation || /^tbd$/i.test(t.abbreviation) || /tbd/i.test(t.displayName ?? "");
}

/**
 * The postseason bracket, reconstructed from the scoreboard's per-game `series`
 * data. Returns null outside the postseason (so the caller shows the regular-
 * season standings instead). Seeds are the league-wide win% ranking.
 *
 * Fetched a month at a time (`dates=YYYYMM`) over the last few months rather than
 * the whole season: a full-season response (~7MB) blows past Next's 2MB fetch-
 * cache limit, so it would never cache and re-downloaded on every render. Each
 * month is well under 2MB and cacheable. The range query (`dates=A-B`) is broken
 * in the postseason, hence per-month. Series objects repeat across a series'
 * games, so distinct series are deduped by team pair + length.
 */
export async function getPlayoffBracket(
  league: TeamLeagueConfig
): Promise<PlayoffBracket | null> {
  // Cheap check first — the default scoreboard says whether we're in the
  // postseason (season type 3), so the regular season skips the rest.
  const now = new Date();
  let year = now.getFullYear();
  try {
    const res = await fetch(`${scoreboardUrl(league)}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json();
    const season = data.leagues?.[0]?.season;
    year = season?.year ?? year;
    if (String(season?.type?.id ?? season?.type?.type) !== "3") return null;
  } catch {
    return null;
  }

  // Fetch only the months the postseason actually spans — pulling a pre-season
  // month (a full regular-season slate can top 2MB) would both waste bandwidth
  // and trip the cache limit. The postseason start comes from ESPN's core API;
  // if that's unavailable, fall back to this and last month.
  let startMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  try {
    // Core API path is "<sport>/leagues/<league>", vs the site API's "<sport>/<league>".
    const [sport, lg] = league.espnPath.split("/");
    const res = await fetch(
      `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${lg}/seasons/${year}/types/3`,
      { next: { revalidate: 86_400 } }
    );
    if (res.ok) {
      const d = new Date((await res.json()).startDate);
      if (!Number.isNaN(d.getTime())) startMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    }
  } catch { /* fall back to the default window */ }

  const months: string[] = [];
  for (
    let d = new Date(startMonth);
    d <= now && months.length < 4;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const perMonth = await Promise.all(
    months.map(async (m) => {
      try {
        const res = await fetch(`${scoreboardUrl(league)}?dates=${m}&limit=400`, {
          next: { revalidate: 300 },
        });
        if (!res.ok) return [] as ESPNScoreEvent[];
        const data = await res.json();
        return (data.events ?? []) as ESPNScoreEvent[];
      } catch {
        return [] as ESPNScoreEvent[];
      }
    })
  );
  const events: ESPNScoreEvent[] = perMonth.flat();

  interface RawSeries {
    bestOf: number;
    summary: string;
    completed: boolean;
    teams: Array<{ team: ESPNScoreTeam; wins: number }>;
  }
  const raw = new Map<string, RawSeries>();
  for (const e of events) {
    const comp = e.competitions?.[0];
    const s = comp?.series;
    if (!comp || !s || s.type !== "playoff") continue;
    const comps = comp.competitors ?? [];
    if (comps.length !== 2) continue;

    const bestOf = s.totalCompetitions ?? 0;
    const key = comps.map((c) => c.team.id ?? "").sort().join("-") + `|bo${bestOf}`;
    const winsById = new Map((s.competitors ?? []).map((c) => [c.id, c.wins ?? 0]));
    const entry: RawSeries = {
      bestOf,
      summary: s.summary ?? "",
      completed: !!s.completed,
      teams: comps.map((c) => ({ team: c.team, wins: winsById.get(c.team.id) ?? 0 })),
    };
    // A series' games can span two fetched months (game 1 in Sep, clincher in
    // Oct), each game carrying the series state *as of that game*. Keep the most
    // advanced record — completed outranks in-progress, then more games played —
    // so the final result wins over an earlier "leads 1-0".
    const advancement = (r: RawSeries) =>
      (r.completed ? 1000 : 0) + r.teams.reduce((n, t) => n + t.wins, 0);
    const prev = raw.get(key);
    if (!prev || advancement(entry) > advancement(prev)) raw.set(key, entry);
  }
  if (raw.size === 0) return null;

  // Seeds: league-wide win% ranking, matched to series teams by abbreviation.
  const seedByAbbrev = new Map<string, number>();
  const standings = await getStandings(league);
  if (standings) {
    standings.conferences
      .flatMap((c) => c.teams)
      .sort((a, b) => parseFloat(b.winPct || "0") - parseFloat(a.winPct || "0"))
      .forEach((t, i) => seedByAbbrev.set(t.abbrev, i + 1));
  }

  const toSeries = (r: RawSeries): BracketSeries => {
    const maxWins = Math.max(...r.teams.map((t) => t.wins));
    const teams = r.teams.map((t): BracketTeam => ({
      id: t.team.id ?? "",
      abbrev: t.team.abbreviation ?? "",
      name: t.team.displayName ?? "TBD",
      logo: t.team.logo,
      seed: seedByAbbrev.get(t.team.abbreviation ?? ""),
      wins: t.wins,
      isWinner: r.completed && maxWins > 0 && t.wins === maxWins,
      tbd: isTbd(t.team),
    }));
    // Higher seed (lower number) on top, matching bracket convention.
    teams.sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
    return {
      round: roundOf(r.bestOf),
      bestOf: r.bestOf,
      teams: teams as [BracketTeam, BracketTeam],
      summary: r.summary,
      completed: r.completed,
      slot: 0,
    };
  };

  const all = [...raw.values()].map(toSeries);
  const first = all.filter((s) => s.round === "first");
  const semi = all.filter((s) => s.round === "semi");
  const final = all.filter((s) => s.round === "final");

  // Slot = top-to-bottom bracket position. First round pairs by top seed:
  // {1,8}→0, {4,5}→1, {2,7}→2, {3,6}→3.
  const firstSlot: Record<number, number> = { 1: 0, 4: 1, 2: 2, 3: 3 };
  const topSeed = (s: BracketSeries) =>
    Math.min(...s.teams.map((t) => t.seed ?? 99));
  first.forEach((s) => (s.slot = firstSlot[topSeed(s)] ?? 9));
  first.sort((a, b) => a.slot - b.slot);
  // Semis: the half holding seeds {1,4,5,8} sits on top.
  semi.forEach((s) => {
    s.slot = s.teams.some((t) => [1, 4, 5, 8].includes(t.seed ?? 0)) ? 0 : 1;
  });
  semi.sort((a, b) => a.slot - b.slot);
  final.forEach((s) => (s.slot = 0));

  return { year, first, semi, final };
}
