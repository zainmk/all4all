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

// ESPN-first unified match — single type for all match cards
export interface ESPNMatch {
  id: string;
  date: number;
  homeTeam: { name: string; logo?: string };
  awayTeam: { name: string; logo?: string };
  score?: { home: number; away: number };
  clock?: string;
  venue?: { stadium: string; city: string; country: string };
  isFinished: boolean;
  isLive: boolean;
  matchTime?: string;
  hideAfterMs?: number;
  sources: MatchSource[];
}
