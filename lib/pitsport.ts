import type { MatchSource, RaceEvent } from "@/types";

// pitsport.st — a motorsport-first stream site whose SvelteKit app reads a
// public JSON API (pitsport.st/api/v1; no docs or published limits, robots.txt
// allows everything). One request per competition returns its current events
// plus the programs (sessions) that are live or upcoming:
//   GET /api/v1/competitions/<id>  →  { ok, data: { events[], live[], upcoming[] } }
// Competition ids are listed at /api/v1/competitions (F1 100000, MotoGP 100003).
const API = "https://pitsport.st/api/v1";
const SITE = "https://pitsport.st";

// Live state flips through a race day, so this is re-checked every couple of
// minutes — the same cadence as the MotoGP results mid-weekend.
const TTL = 120;
const TIMEOUT_MS = 3_000;
const HOUR = 3_600_000;

// Competitions also list shows between sessions ("Mexico City — Ted's Quali
// Notebook"); only actual sessions should become the card's link.
const SESSION = /\b(?:practice|qualifying|sprint|race|warm-?up|shootout)\b/i;

interface PitsportEvent {
  title: string;
  href: string;
  start: number;
  end: number;
}

interface PitsportProgram {
  title: string;
  href: string;
  start: number;
  live: boolean;
}

export interface PitsportFeed {
  events: PitsportEvent[];
  programs: PitsportProgram[];
}

interface RawItem {
  titleText?: unknown;
  href?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  sessionStart?: unknown;
  liveState?: unknown;
}

const isHref = (h: unknown): h is string => typeof h === "string" && h.startsWith("/");

/** A competition's current events and live/upcoming programs, or null on any failure. */
export async function getPitsportFeed(competitionId: number): Promise<PitsportFeed | null> {
  try {
    const res = await fetch(`${API}/competitions/${competitionId}`, {
      next: { revalidate: TTL },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = ((await res.json()) as { data?: Record<string, unknown> } | null)?.data;
    if (!data || !Array.isArray(data.events)) return null;
    const list = (v: unknown) => (Array.isArray(v) ? (v as RawItem[]) : []);

    const events = list(data.events)
      .filter((e) => isHref(e.href))
      .map((e) => ({
        title: String(e.titleText ?? ""),
        href: e.href as string,
        start: Date.parse(String(e.startsAt)),
        end: Date.parse(String(e.endsAt)),
      }))
      .filter((e) => !Number.isNaN(e.start) && !Number.isNaN(e.end));

    // Alternate feeds repeat a session's title and start; the main feed is listed first
    const programs = [...list(data.live), ...list(data.upcoming)]
      .filter((p) => isHref(p.href) && typeof p.sessionStart === "number")
      .map((p) => ({
        title: String(p.titleText ?? ""),
        href: p.href as string,
        start: (p.sessionStart as number) * 1000,
        live: p.liveState === "live",
      }));

    return { events, programs };
  } catch {
    return null;
  }
}

/**
 * pitsport's link for a race weekend: the event whose dates overlap the round,
 * then its session that's live, else the next to start, else the event page.
 */
export function pitsportForRound(
  feed: PitsportFeed,
  round: Pick<RaceEvent, "dateStart" | "dateEnd" | "raceStart">,
  now: number
): MatchSource[] {
  // First practice to the race's finish; MotoGP's dateEnd is a bare date (midnight)
  const from = round.dateStart - 6 * HOUR;
  const to = Math.max(round.dateEnd + 24 * HOUR, (round.raceStart ?? 0) + 4 * HOUR);
  const event = feed.events.find((e) => e.start <= to && e.end >= from);
  if (!event) return [];

  const ofEvent = feed.programs.filter(
    (p) => SESSION.test(p.title) && p.start >= event.start - HOUR && p.start <= event.end + HOUR
  );
  const live = ofEvent.find((p) => p.live);
  const next = ofEvent.filter((p) => !p.live && p.start > now).sort((a, b) => a.start - b.start)[0];
  const href = (live ?? next ?? event).href;
  return [{ source: "pitsport", id: `pitsport-${href}`, url: `${SITE}${href}` }];
}
