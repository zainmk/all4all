import type { PodiumEntry, RaceResults } from "@/types";

// OpenF1 — free, no auth for anything outside a live session. Used only to fill
// in session results jolpica hasn't published yet: OpenF1 posts them minutes
// after the official classification, while jolpica can lag a day or more.
//
// While any F1 session is live (30 min before it until 30 min after) OpenF1
// closes its free API and every request 401s, historical data included. Any
// failure here just means "nothing to add" — the caller keeps jolpica's data.
const BASE = "https://api.openf1.org/v1";

// Long on purpose. Next only caches 200s, so a not-yet-published result (404)
// or a lockout (401) is never pinned — it just retries next render. And when an
// ISR regeneration hits a *stale* entry it refetches in the foreground and uses
// whatever comes back, so a short TTL would let a lockout 401 blank a podium
// that's already been fetched. A day keeps good responses fresh through the
// windows; jolpica takes over well before results could be revised.
const OPENF1_TTL = 86_400;

export type F1SessionKind = keyof RaceResults;

/** A session that should be over but has no podium from jolpica yet. */
export interface WantedSession {
  round: string;
  kind: F1SessionKind;
  /** Scheduled start, ms — pairs it with OpenF1's copy of the session */
  start: number;
}

const SESSION_NAME: Record<F1SessionKind, string> = {
  qualifying: "Qualifying",
  sprint: "Sprint",
  race: "Race",
};

// Minutes from a session's start until its result is fetchable on the free
// tier: its usual length, plus the 30 minutes the API stays closed after.
const READY_AFTER_MINS: Record<F1SessionKind, number> = { qualifying: 90, sprint: 90, race: 150 };

// jolpica and OpenF1 agree on start times bar the odd reschedule (Miami 2026's
// race is 3h apart), and same-named sessions are a week apart, so the nearest
// within half a day is unambiguous.
const MATCH_WINDOW_MS = 12 * 3_600_000;

interface OF1Session {
  session_key: number;
  session_name: string;
  date_start: string;
  is_cancelled?: boolean;
}
interface OF1Result {
  session_key: number;
  position: number;
  driver_number: number;
  points?: number;
  /** Race/sprint: total seconds. Qualifying: [Q1, Q2, Q3] seconds. */
  duration?: number | Array<number | null> | null;
  /** Seconds behind the winner, or e.g. "+1 LAP" */
  gap_to_leader?: number | string | null;
}
interface OF1Driver {
  session_key: number;
  driver_number: number;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  team_name?: string;
}

async function getJSON<T>(path: string, revalidate: number): Promise<T[] | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? (data as T[]) : null;
  } catch {
    return null;
  }
}

/** 94.035 → "1:34.035"; 6120.785 → "1:42:00.785" (jolpica's formats). */
function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(3).padStart(6, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function entryTime(kind: F1SessionKind, r: OF1Result): string {
  if (kind === "qualifying") {
    // Furthest part reached — Q3 for anyone in the top three
    const laps = Array.isArray(r.duration) ? r.duration.filter((t): t is number => typeof t === "number") : [];
    return laps.length ? clock(laps[laps.length - 1]) : "";
  }
  if (r.position === 1) return typeof r.duration === "number" ? clock(r.duration) : "";
  if (typeof r.gap_to_leader === "number") return `+${r.gap_to_leader.toFixed(3)}`;
  return r.gap_to_leader ?? "";
}

/**
 * Top-three podiums from OpenF1 for the given sessions, as round → kind →
 * entries. Skips sessions too recent for the free tier to serve, and makes no
 * requests at all when nothing is wanted (the usual case between weekends).
 */
export async function getOpenF1Podiums(
  season: string,
  wanted: WantedSession[],
  now: number
): Promise<Map<string, Partial<Record<F1SessionKind, PodiumEntry[]>>>> {
  const out = new Map<string, Partial<Record<F1SessionKind, PodiumEntry[]>>>();
  const ready = wanted.filter((w) => now > w.start + READY_AFTER_MINS[w.kind] * 60_000);
  if (ready.length === 0) return out;

  const sessions = await getJSON<OF1Session>(`/sessions?year=${season}`, OPENF1_TTL);
  if (!sessions) return out;

  const byKey = new Map<number, WantedSession>();
  for (const w of ready) {
    let best: OF1Session | undefined;
    let bestGap = MATCH_WINDOW_MS;
    for (const s of sessions) {
      if (s.session_name !== SESSION_NAME[w.kind] || s.is_cancelled) continue;
      const gap = Math.abs(Date.parse(s.date_start) - w.start);
      if (gap <= bestGap) {
        best = s;
        bestGap = gap;
      }
    }
    if (best) byKey.set(best.session_key, w);
  }
  if (byKey.size === 0) return out;

  // Repeating session_key ORs them, so each of these is one request
  const keys = [...byKey.keys()].map((k) => `session_key=${k}`).join("&");
  const [results, drivers] = await Promise.all([
    getJSON<OF1Result>(`/session_result?position%3C=3&${keys}`, OPENF1_TTL),
    getJSON<OF1Driver>(`/drivers?${keys}`, OPENF1_TTL),
  ]);
  // Without names a podium is just car numbers — not worth showing
  if (!results || !drivers) return out;

  const driverOf = new Map(drivers.map((d) => [`${d.session_key}:${d.driver_number}`, d]));
  for (const r of results.sort((a, b) => a.position - b.position)) {
    const w = byKey.get(r.session_key);
    const d = driverOf.get(`${r.session_key}:${r.driver_number}`);
    if (!w || !d || r.position > 3) continue;
    const entry: PodiumEntry = {
      position: r.position,
      rider: `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() || (d.full_name ?? ""),
      team: d.team_name ?? "",
      time: entryTime(w.kind, r),
      points: w.kind === "qualifying" ? undefined : r.points,
    };
    const round = out.get(w.round) ?? {};
    (round[w.kind] ??= []).push(entry);
    out.set(w.round, round);
  }
  return out;
}
