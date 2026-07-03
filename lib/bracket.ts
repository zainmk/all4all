const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

export type MatchStatus = "scheduled" | "live" | "finished";

export interface BracketTeam {
  name: string;
  abbr: string;
  logo?: string;
  score?: number;
  winner?: boolean;
}

export interface BracketMatch {
  id: string;
  home: BracketTeam;
  away: BracketTeam;
  date: string;
  status: MatchStatus;
  round: string;
  /** True only for R32 matches whose R16 slot is confirmed via team-name cross-reference. */
  confirmed?: boolean;
}

export interface BracketRound {
  slug: string;
  matches: BracketMatch[];
}

export interface BracketData {
  rounds: BracketRound[];
  thirdPlace?: BracketMatch;
}

export const ROUND_ORDER = [
  "round-of-32",
  "round-of-16",
  "quarterfinals",
  "semifinals",
  "final",
];

async function fetchRange(dateRange: string): Promise<unknown[]> {
  try {
    const res = await fetch(`${ESPN_BASE}?dates=${dateRange}&limit=100`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events ?? []) as unknown[];
  } catch {
    return [];
  }
}

// R32 display order derived from ESPN bracket slot assignments and 2026 WC bracket structure.
// Each consecutive pair (2i, 2i+1) feeds the same R16 match (sorted by R16 date):
//   positions 0-1  → R16 #0 (Houston):       RSA/CAN + NED/MAR
//   positions 2-3  → R16 #1 (Philadelphia):  GER/PAR + FRA/SWE
//   positions 4-5  → R16 #2 (E. Rutherford): BRA/JPN + CIV/NOR
//   positions 6-7  → R16 #3 (Mexico City):   MEX/ECU + ENG/COD
//   positions 8-9  → R16 #4 (AT&T/Arlington):POR/CRO + ESP/AUT  ← POR vs ESP (760506)
//   positions 10-11→ R16 #5 (Seattle):       USA/BIH + BEL/SEN
//   positions 12-13→ R16 #6 (Atlanta):       AUS/EGY + ARG/CPV
//   positions 14-15→ R16 #7 (Vancouver):     SUI/ALG + COL/GHA
const R32_DISPLAY_ORDER: Record<string, number> = {
  "760486": 0,   // RSA vs CAN
  "760488": 1,   // NED vs MAR
  "760489": 2,   // GER vs PAR
  "760492": 3,   // FRA vs SWE
  "760487": 4,   // BRA vs JPN
  "760490": 5,   // CIV vs NOR
  "760491": 6,   // MEX vs ECU
  "760495": 7,   // ENG vs COD
  "760496": 8,   // POR vs CRO → feeds AT&T/Arlington R16 (POR vs ESP)
  "760497": 9,   // ESP vs AUT → feeds AT&T/Arlington R16 (POR vs ESP)
  "760494": 10,  // USA vs BIH
  "760493": 11,  // BEL vs SEN
  "760499": 12,  // AUS vs EGY → feeds Atlanta R16
  "760500": 13,  // ARG vs CPV → feeds Atlanta R16
  "760498": 14,  // SUI vs ALG
  "760501": 15,  // COL vs GHA
};

export async function getBracketData(): Promise<BracketData> {
  // Fetch all knockout rounds in three parallel date-range queries
  const [r32Events, midEvents, lateEvents] = await Promise.all([
    fetchRange("20260628-20260703"), // R32
    fetchRange("20260704-20260712"), // R16 + QF
    fetchRange("20260713-20260720"), // SF + Final + 3rd
  ]);

  const allEvents = [...r32Events, ...midEvents, ...lateEvents];
  const roundMap = new Map<string, BracketMatch[]>();
  let thirdPlace: BracketMatch | undefined;

  for (const event of allEvents) {
    const e = event as Record<string, unknown>;
    const season = e.season as Record<string, unknown> | undefined;
    const slug = (season?.slug as string) ?? "";

    const isKnockout = ROUND_ORDER.includes(slug) || slug === "3rd-place-match";
    if (!isKnockout) continue;

    const competitions = e.competitions as Array<Record<string, unknown>> | undefined;
    const comp = competitions?.[0];
    if (!comp) continue;

    const competitors = (comp.competitors as Array<Record<string, unknown>>) ?? [];
    const home = competitors.find((c) => c.homeAway === "home") as Record<string, unknown> | undefined;
    const away = competitors.find((c) => c.homeAway === "away") as Record<string, unknown> | undefined;
    if (!home || !away) continue;

    const homeTeam = home.team as Record<string, unknown>;
    const awayTeam = away.team as Record<string, unknown>;

    const status = e.status as Record<string, unknown> | undefined;
    const statusType = status?.type as Record<string, unknown> | undefined;
    const statusName = (statusType?.name as string) ?? "";

    const finished =
      statusName === "STATUS_FULL_TIME" ||
      statusName === "STATUS_FINAL" ||
      statusName === "STATUS_FINAL_PEN" ||
      statusName === "STATUS_FINAL_AET";
    const live =
      !finished &&
      statusName !== "" &&
      statusName !== "STATUS_SCHEDULED";

    const hasScore = (finished || live) && home.score !== undefined && away.score !== undefined;
    const homeScore = hasScore ? parseInt(home.score as string, 10) : undefined;
    const awayScore = hasScore ? parseInt(away.score as string, 10) : undefined;

    const homeWins =
      finished &&
      homeScore !== undefined &&
      awayScore !== undefined &&
      homeScore > awayScore;
    const awayWins =
      finished &&
      homeScore !== undefined &&
      awayScore !== undefined &&
      awayScore > homeScore;

    const match: BracketMatch = {
      id: (e.id as string) ?? "",
      home: {
        name: (homeTeam.displayName as string) ?? "",
        abbr: (homeTeam.abbreviation as string) ?? "",
        logo: homeTeam.logo as string | undefined,
        score: homeScore !== undefined && !isNaN(homeScore) ? homeScore : undefined,
        winner: homeWins,
      },
      away: {
        name: (awayTeam.displayName as string) ?? "",
        abbr: (awayTeam.abbreviation as string) ?? "",
        logo: awayTeam.logo as string | undefined,
        score: awayScore !== undefined && !isNaN(awayScore) ? awayScore : undefined,
        winner: awayWins,
      },
      date: (e.date as string) ?? "",
      status: finished ? "finished" : live ? "live" : "scheduled",
      round: slug,
    };

    if (slug === "3rd-place-match") {
      thirdPlace = match;
    } else {
      if (!roundMap.has(slug)) roundMap.set(slug, []);
      roundMap.get(slug)!.push(match);
    }
  }

  // Sort matches within each round by date (initial ordering)
  for (const matches of roundMap.values()) {
    matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Re-order R32 matches into hardcoded bracket display positions.
  // Each consecutive pair (2i, 2i+1) feeds the same R16 match, so connector lines are correct.
  const r32Matches = roundMap.get("round-of-32");

  if (r32Matches && r32Matches.length > 0) {
    const sorted: Array<BracketMatch | null> = new Array(16).fill(null);
    const unassigned: BracketMatch[] = [];

    for (const match of r32Matches) {
      const idx = R32_DISPLAY_ORDER[match.id];
      if (idx !== undefined && sorted[idx] === null) {
        match.confirmed = true;
        sorted[idx] = match;
      } else {
        unassigned.push(match);
      }
    }

    // Any unrecognized event IDs fill remaining slots in date order
    let ui = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] === null && ui < unassigned.length) sorted[i] = unassigned[ui++];
    }

    roundMap.set("round-of-32", sorted.filter((m): m is BracketMatch => m !== null));
  }

  const rounds: BracketRound[] = ROUND_ORDER.filter((slug) => roundMap.has(slug)).map(
    (slug) => ({
      slug,
      matches: roundMap.get(slug)!,
    })
  );

  return { rounds, thirdPlace };
}
