export interface MatchSource {
  source: string;
  id: string;
  url?: string; // direct link override (bypasses embed.st)
  label?: string; // badge text override (e.g. "MotoGP" / "Moto2"); defaults to `source`
}

// Used by streamed.pk API helpers only
export interface TeamInfo { name: string; badge: string; }
export interface Teams { home?: TeamInfo; away?: TeamInfo; }
export interface Match {
  id: string; title: string; category: string; date: number;
  poster?: string; popular?: boolean; teams?: Teams; sources: MatchSource[];
}

export interface PodiumEntry {
  position: number;
  rider: string;
  team: string;
  /** Leader's time, or the gap to first for P2/P3 */
  time: string;
  /** Championship points — absent for qualifying, which scores none */
  points?: number;
}

export interface SessionInfo {
  /** Scheduled start datetime, when known (drives the "when's the next session" line) */
  start?: number;
  /** Top three, once the session has run; empty beforehand */
  podium: PodiumEntry[];
}

/** The sessions worth showing for a round: their times and (once run) podiums. */
export interface RaceResults {
  qualifying: SessionInfo;
  sprint: SessionInfo;
  race: SessionInfo;
}

/** One round of a race series — a multi-day event at a single circuit. */
export interface RaceEvent {
  id: string;
  name: string;
  /** Three-letter round code, e.g. "GBR" */
  shortName: string;
  countryIso: string;
  circuit: string;
  place: string;
  dateStart: number;
  dateEnd: number;
  /** Exact start of the main race session (with time of day), when known */
  raceStart?: number;
  isFinished: boolean;
  round: number;
  results: RaceResults;
  sources: MatchSource[];
}

export interface StandingEntry {
  position: number;
  /** Places gained (+) or lost (−) at the last round */
  positionChange: number;
  /** Rider (MotoGP) or driver (F1) name */
  rider: string;
  riderNumber: number;
  countryIso: string;
  team: string;
  points: number;
  raceWins: number;
  /** Not every series' API aggregates these; omit when unavailable */
  podiums?: number;
  sprintWins?: number;
  /** Finish at each of the most recent rounds; null = did not finish/start */
  recent?: Array<{ round: string; position: number | null }>;
}

/** Everything needed to read the state of the championship at a glance. */
export interface ChampionshipStatus {
  year: number;
  roundsComplete: number;
  roundsTotal: number;
  nextRound?: { name: string; dateStart: number };
  /** Maximum points still winnable — 25 (race) + 12 (sprint) per round left */
  pointsRemaining: number;
  standings: StandingEntry[];
}

export interface TeamStanding {
  seed: number;
  team: string;
  abbrev: string;
  logo?: string;
  wins: number;
  losses: number;
  /** e.g. ".615" */
  winPct: string;
  /** "-" for the leader, else "2.5" */
  gamesBehind: string;
  /** "W3" / "L1" */
  streak: string;
  /** last ten games, e.g. "7-3" */
  lastTen: string;
}

export interface ConferenceStandings {
  name: string;
  teams: TeamStanding[];
}

/** A league table grouped by conference/division. */
export interface TeamStandingsData {
  title: string;
  conferences: ConferenceStandings[];
}

// ── Playoff bracket ──────────────────────────────────────────────────────────

export interface BracketTeam {
  id: string;
  abbrev: string;
  name: string;
  logo?: string;
  /** League-wide playoff seed (1–8), when known */
  seed?: number;
  /** Series wins so far */
  wins: number;
  /** Won the series */
  isWinner: boolean;
  /** Placeholder (series not yet filled, e.g. the Finals before semis finish) */
  tbd: boolean;
}

export interface BracketSeries {
  round: "first" | "semi" | "final";
  /** Series length: 3 / 5 / 7 */
  bestOf: number;
  teams: [BracketTeam, BracketTeam];
  /** ESPN's phrase, e.g. "NY wins series 2-0" / "Series starts 10/4" */
  summary: string;
  completed: boolean;
  /** Top-to-bottom position within its round, for bracket layout */
  slot: number;
}

export interface PlayoffBracket {
  year: number;
  first: BracketSeries[];
  semi: BracketSeries[];
  final: BracketSeries[];
}

export interface GoalEvent {
  scorer: string;   // last name only
  minute: string;   // e.g. "29'", "90'+2'"
  team: "home" | "away";
}

export interface TeamInfoESPN {
  name: string;
  logo?: string;
  winner?: boolean;
}

// ESPN-first unified match — single type for all match cards
export interface ESPNMatch {
  id: string;
  date: number;
  homeTeam: TeamInfoESPN;
  awayTeam: TeamInfoESPN;
  score?: { home: number; away: number };
  clock?: string;
  venue?: { stadium: string; city: string; country: string };
  isFinished: boolean;
  isLive: boolean;
  isPostponed: boolean;
  matchTime?: string;
  hideAfterMs?: number;
  goals: GoalEvent[];
  sources: MatchSource[];
}
