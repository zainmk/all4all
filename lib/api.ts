import type { Match } from "@/types";

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

export function filterByCategory(matches: Match[], category: string): Match[] {
  return matches.filter(
    (m) =>
      m.category?.toLowerCase() === category &&
      m.teams?.home?.name &&
      m.teams?.away?.name
  );
}

