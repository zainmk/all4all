// Per-league configuration. Everything that differs between the league pages
// lives here so the page chrome and cards stay shared.

export type LeagueId = "nba" | "wnba" | "motogp" | "f1";

/** Presentation + stream-picking bits every league page needs. */
interface LeagueChrome {
  id: LeagueId;
  href: string;
  /** Header wordmark */
  label: string;
  /** <title>, suffixed with "· all4all" by the root layout */
  title: string;
  description: string;
  logo: string;
  logoAlt: string;
  /** Logo already spells out the league name — don't repeat it as text beside it */
  logoIsWordmark?: boolean;
  /** Accent as "r,g,b" so callers can build rgba() at any alpha */
  accent: string;
  /** Page background gradient */
  background: string;
  /** Ambient glow blobs */
  blobs: Array<{ color: string; className: string; opacity: number; stop: string }>;
  footer: string;
}

/** Fixture-based leagues: two teams, a score, an ESPN scoreboard. */
export interface TeamLeagueConfig extends LeagueChrome {
  kind: "team";
  /** ESPN scoreboard path segment, e.g. "basketball/nba" */
  espnPath: string;
  /** Scrape totalsportek listings for game pages (its link format churns often) */
  useSportek: boolean;
  /**
   * ppv.st listing for this league. `tag` is ppv's league tag ("NBA"); games are
   * matched against its API on that plus both team names. `path` ("nba") opts
   * into built links when the API is unreachable — only set it where ppv's URL
   * pattern has been checked against real listings (see lib/ppv.ts).
   */
  ppv?: { tag: string; path?: string };
  /** Desktop click-through order, by source name. First match wins. */
  desktopPriority: string[];
  /** Mobile click-through order — only sources that work in a mobile browser. */
  mobilePriority: string[];
  /**
   * Detail line under the score. "goals" reads ESPN scoring plays;
   * "none" leaves the card at score only.
   */
  detail: "goals" | "none";
  /** Fallback when a team has no ESPN logo */
  teamFallback: "flag" | "initials";
  /**
   * Typical run time in minutes, used to keep a finished game on the page
   * (with its stream) for a grace period after the final whistle/buzzer.
   * Soccer derives this from the match clock instead; this is the fallback.
   */
  typicalDurationMins: number;
  /** "kick-off" / "tip-off" — used in empty-state copy */
  startNoun: string;
  /** Days either side of today to pull from ESPN. Defaults to 3 back, 3 ahead. */
  matchWindow?: { back: number; ahead: number };
  /** Show an ESPN conference-standings card above the NOW divider */
  hasStandings?: boolean;
  /**
   * Swap the standings card for a playoff bracket in the postseason. The bracket
   * builder in lib/espn.ts assumes the WNBA format (8 teams, best-of-3/5/7
   * rounds), so leave this off for leagues shaped differently.
   */
  hasPlayoffBracket?: boolean;
  /** Seed lines ruled across each conference table, e.g. playoff / play-in. */
  standingsCutoffs?: Array<{ after: number; label: string }>;
}

/** Race series: a calendar of multi-day events with a podium, no fixtures. */
export interface RaceLeagueConfig extends LeagueChrome {
  kind: "race";
  /** Full URL of the sportek category page listing this series' stream pages */
  sportekPath: string;
  /**
   * Words that identify this series in a ppv.st listing's tag or title. A
   * listing matching one, inside the race weekend, becomes the round's link.
   */
  ppvKeywords?: string[];
  /** Standings heading, minus the year — "MotoGP Riders’ Championship" */
  championshipTitle: string;
  /** Plural competitor noun for the standings expand button — "riders" / "drivers" */
  competitorPlural: string;
}

export type LeagueConfig = TeamLeagueConfig | RaceLeagueConfig;

export const LEAGUES: Record<LeagueId, LeagueConfig> = {
  wnba: {
    kind: "team",
    id: "wnba",
    href: "/wnba",
    label: "WNBA",
    title: "WNBA",
    description: "Watch live and upcoming WNBA games",
    logo: "/wnba-logo.png",
    logoAlt: "WNBA",
    espnPath: "basketball/wnba",
    useSportek: true,
    detail: "none",
    teamFallback: "initials",
    // ~2h05 of wall-clock for a 40-minute game
    typicalDurationMins: 125,
    // No built-link fallback: ppv's WNBA URLs haven't been seen yet
    ppv: { tag: "WNBA" },
    desktopPriority: ["ppv", "sportek"],
    // sportek pages don't play in a mobile browser
    mobilePriority: ["ppv"],
    accent: "249,115,22",
    background:
      "linear-gradient(160deg, #3a1205 0%, #1d0c07 30%, #080505 60%, #0a0509 100%)",
    blobs: [
      { color: "#ea580c", className: "absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px]", opacity: 0.35, stop: "65%" },
      { color: "#7c2d12", className: "absolute -top-10 -left-32 w-[700px] h-[700px]", opacity: 0.28, stop: "65%" },
      { color: "#831843", className: "absolute bottom-0 -right-40 w-[700px] h-[700px]", opacity: 0.2, stop: "65%" },
      { color: "#f97316", className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px]", opacity: 0.09, stop: "70%" },
    ],
    startNoun: "tip-off",
    hasStandings: true,
    hasPlayoffBracket: true,
    footer: "Streams by ppv.st & totalsportek · Scores by ESPN",
  },
  nba: {
    kind: "team",
    id: "nba",
    href: "/nba",
    label: "NBA",
    title: "NBA",
    description: "Watch live and upcoming NBA games",
    logo: "/nba-logo.png",
    logoAlt: "NBA",
    espnPath: "basketball/nba",
    useSportek: false,
    ppv: { tag: "NBA", path: "nba" },
    detail: "none",
    teamFallback: "initials",
    // ~2h15 of wall-clock for a 48-minute game
    typicalDurationMins: 135,
    // Up to 15 games a night — the default window would bury the page in cards
    matchWindow: { back: 1, ahead: 2 },
    desktopPriority: ["ppv"],
    mobilePriority: ["ppv"],
    // The logo's blue, lifted so it reads as text on the dark page
    accent: "59,130,246",
    background:
      "linear-gradient(160deg, #0c1a3d 0%, #0a0f24 30%, #050508 60%, #0d0509 100%)",
    blobs: [
      { color: "#1d428a", className: "absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px]", opacity: 0.4, stop: "65%" },
      { color: "#1e3a8a", className: "absolute -top-10 -left-32 w-[700px] h-[700px]", opacity: 0.28, stop: "65%" },
      { color: "#c8102e", className: "absolute bottom-0 -right-40 w-[700px] h-[700px]", opacity: 0.16, stop: "65%" },
      { color: "#3b82f6", className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px]", opacity: 0.08, stop: "70%" },
    ],
    startNoun: "tip-off",
    hasStandings: true,
    // No hasPlayoffBracket yet: 16 teams, conference-split, every round best-of-7
    // plus a play-in — needs its own builder before the April postseason.
    standingsCutoffs: [
      { after: 6, label: "Playoffs" },
      { after: 10, label: "Play-In" },
    ],
    footer: "Streams by ppv.st · Scores by ESPN",
  },
  f1: {
    kind: "race",
    id: "f1",
    href: "/f1",
    label: "F1",
    title: "Formula 1",
    description: "Formula 1 race calendar, results and live streams",
    logo: "/f1-logo.svg",
    logoAlt: "Formula 1",
    logoIsWordmark: true,
    sportekPath: "https://live.totalsporteki.st/formula1-streams/",
    ppvKeywords: ["formula 1", "formula one", "f1"],
    championshipTitle: "Formula 1 Drivers’ Championship",
    competitorPlural: "drivers",
    // The red from the logo (#DE1101)
    accent: "222,17,1",
    background:
      "linear-gradient(160deg, #360604 0%, #1c0606 32%, #0b0403 62%, #090405 100%)",
    blobs: [
      { color: "#de1101", className: "absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px]", opacity: 0.3, stop: "65%" },
      { color: "#7f1d1d", className: "absolute -top-10 -left-32 w-[700px] h-[700px]", opacity: 0.26, stop: "65%" },
      { color: "#450a0a", className: "absolute bottom-0 -right-40 w-[700px] h-[700px]", opacity: 0.32, stop: "65%" },
      { color: "#dc2626", className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px]", opacity: 0.08, stop: "70%" },
    ],
    footer: "Streams by ppv.st & totalsportek · Results by jolpica (Ergast) & OpenF1",
  },
  motogp: {
    kind: "race",
    id: "motogp",
    href: "/motogp",
    label: "MOTOGP",
    title: "MotoGP",
    description: "MotoGP race calendar, results and live streams",
    logo: "/motogp-logo.svg",
    logoAlt: "MotoGP",
    logoIsWordmark: true,
    sportekPath: "https://live.totalsporteki.st/motogp-streams/",
    ppvKeywords: ["motogp", "moto gp"],
    championshipTitle: "MotoGP Riders’ Championship",
    competitorPlural: "riders",
    // Monochrome graphite to match the black/silver wordmark, not the old crimson
    accent: "161,161,170",
    background:
      "linear-gradient(160deg, #26262b 0%, #17171a 32%, #0b0b0d 62%, #0a0a0c 100%)",
    blobs: [
      { color: "#52525b", className: "absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px]", opacity: 0.3, stop: "65%" },
      { color: "#3f3f46", className: "absolute -top-10 -left-32 w-[700px] h-[700px]", opacity: 0.32, stop: "65%" },
      { color: "#27272a", className: "absolute bottom-0 -right-40 w-[700px] h-[700px]", opacity: 0.35, stop: "65%" },
      { color: "#71717a", className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px]", opacity: 0.08, stop: "70%" },
    ],
    footer: "Streams by ppv.st & totalsportek · Results by motogp.com",
  },
};

// Header switcher order
export const LEAGUE_ORDER: LeagueId[] = ["nba", "wnba", "motogp", "f1"];
