export interface TeamInfo {
  name: string;
  badge: string;
}

export interface Teams {
  home?: TeamInfo;
  away?: TeamInfo;
}

export interface MatchSource {
  source: string;
  id: string;
}

export interface Match {
  id: string;
  title: string;
  category: string;
  date: number;
  poster?: string;
  popular?: boolean;
  teams?: Teams;
  sources: MatchSource[];
}

export interface Stream {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  embedUrl: string;
  source: string;
}

export interface MatchEnrichment {
  score?: { home: number; away: number };
  clock?: string;
  venue?: { stadium: string; city: string; country: string };
  isFinished?: boolean;
}

export interface PastMatch {
  id: string;
  date: number;
  homeTeam: string;
  awayTeam: string;
  homeBadge?: string;
  awayBadge?: string;
  score: { home: number; away: number };
  venue?: { stadium: string; city: string; country: string };
  matchTime?: string;
}
