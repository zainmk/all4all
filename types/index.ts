export interface MatchSource {
  source: string;
  id: string;
  url?: string; // direct link override (bypasses embed.st)
}

// Used by streamed.pk API helpers only
export interface TeamInfo { name: string; badge: string; }
export interface Teams { home?: TeamInfo; away?: TeamInfo; }
export interface Match {
  id: string; title: string; category: string; date: number;
  poster?: string; popular?: boolean; teams?: Teams; sources: MatchSource[];
}

export interface GoalEvent {
  scorer: string;   // last name only
  minute: string;   // e.g. "29'", "90'+2'"
  team: "home" | "away";
}

// ESPN-first unified match — single type for all match cards
export interface ESPNMatch {
  id: string;
  date: number;
  homeTeam: { name: string; logo?: string; winner?: boolean };
  awayTeam: { name: string; logo?: string; winner?: boolean };
  score?: { home: number; away: number };
  clock?: string;
  venue?: { stadium: string; city: string; country: string };
  isFinished: boolean;
  isLive: boolean;
  matchTime?: string;
  hideAfterMs?: number;
  goals: GoalEvent[];
  sources: MatchSource[];
}
