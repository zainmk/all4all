import type { Match, MatchSource } from "@/types";

const BASE = "https://streamed.pk/api";

export async function getLiveMatches(): Promise<Match[] | null> {
  try {
    const res = await fetch(`${BASE}/matches/live`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getTodayMatches(): Promise<Match[] | null> {
  try {
    const res = await fetch(`${BASE}/matches/all-today`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function embedUrl(source: string, id: string, streamNo = 1): string {
  return `https://embed.st/embed/${source}/${id}/${streamNo}`;
}

export function badgeUrl(badge: string): string {
  return `${BASE}/images/badge/${badge}.webp`;
}

export function filterFootball(matches: Match[]): Match[] {
  return matches.filter(
    (m) =>
      m.category?.toLowerCase() === "football" &&
      m.teams?.home?.name &&
      m.teams?.away?.name
  );
}

export function usableSources(sources: MatchSource[]): MatchSource[] {
  return sources;
}
