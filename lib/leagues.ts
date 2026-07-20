// Per-league configuration. Everything that differs between the league pages
// lives here so the page chrome and cards stay shared.

export type LeagueId = "fifa" | "wnba" | "motogp";

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
  /** Desktop click-through order, by source name. First match wins. */
  desktopPriority: string[];
  /** Mobile click-through order — only sources that work in a mobile browser. */
  mobilePriority: string[];
  footer: string;
}

/** Fixture-based leagues: two teams, a score, an ESPN scoreboard. */
export interface TeamLeagueConfig extends LeagueChrome {
  kind: "team";
  /** ESPN scoreboard path segment, e.g. "soccer/fifa.world" */
  espnPath: string;
  /** streamed.pk `category` value for this league */
  streamCategory: string;
  /** footybite only carries soccer */
  useFootybite: boolean;
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
}

/** Race series: a calendar of multi-day events with a podium, no fixtures. */
export interface RaceLeagueConfig extends LeagueChrome {
  kind: "race";
  /** sportek category page listing this series' stream pages */
  sportekPath: string;
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
    streamCategory: "basketball",
    useFootybite: false,
    detail: "none",
    teamFallback: "initials",
    // ~2h05 of wall-clock for a 40-minute game
    typicalDurationMins: 125,
    desktopPriority: ["sportek", "admin", "echo"],
    mobilePriority: ["echo", "admin"],
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
    footer: "Streams by totalsportek & streamed.pk · Scores by ESPN",
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
    sportekPath: "/motogp-stream/",
    desktopPriority: ["sportek", "admin", "delta"],
    mobilePriority: ["echo", "admin"],
    // Matches the #D90042 in the logo
    accent: "217,0,66",
    background:
      "linear-gradient(160deg, #3a0510 0%, #1c070b 30%, #080506 60%, #0a0508 100%)",
    blobs: [
      { color: "#be123c", className: "absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px]", opacity: 0.32, stop: "65%" },
      { color: "#7f1d1d", className: "absolute -top-10 -left-32 w-[700px] h-[700px]", opacity: 0.28, stop: "65%" },
      { color: "#1e293b", className: "absolute bottom-0 -right-40 w-[700px] h-[700px]", opacity: 0.3, stop: "65%" },
      { color: "#dc2626", className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px]", opacity: 0.09, stop: "70%" },
    ],
    footer: "Streams by totalsportek · Results by motogp.com",
  },
  fifa: {
    kind: "team",
    id: "fifa",
    href: "/fifa",
    label: "FIFA26",
    title: "FIFA 26",
    description: "Watch live and upcoming football matches",
    logo: "/fifa26-logo.png",
    logoAlt: "FIFA 26",
    espnPath: "soccer/fifa.world",
    streamCategory: "football",
    useFootybite: true,
    detail: "goals",
    teamFallback: "flag",
    typicalDurationMins: 95,
    desktopPriority: ["tsn", "fox", "itv1", "bbc", "admin", "sportek"],
    mobilePriority: ["echo", "admin"],
    accent: "251,191,36",
    background:
      "linear-gradient(160deg, #0d1a3a 0%, #090d1f 30%, #050508 60%, #080d0a 100%)",
    blobs: [
      { color: "#92400e", className: "absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px]", opacity: 0.35, stop: "65%" },
      { color: "#1e3a8a", className: "absolute -top-10 -left-32 w-[700px] h-[700px]", opacity: 0.25, stop: "65%" },
      { color: "#064e3b", className: "absolute bottom-0 -right-40 w-[700px] h-[700px]", opacity: 0.2, stop: "65%" },
      { color: "#1d4ed8", className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px]", opacity: 0.1, stop: "70%" },
    ],
    startNoun: "kick-off",
    footer: "Streams by streamed.pk · Scores by ESPN",
  },
};

// Header switcher order
export const LEAGUE_ORDER: LeagueId[] = ["wnba", "motogp", "fifa"];
