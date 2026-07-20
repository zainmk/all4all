import type { ESPNMatch, GoalEvent } from "@/types";
import type { TeamLeagueConfig } from "@/lib/leagues";
import { resolveAlias } from "@/lib/team-aliases";

// ESPN public scoreboard API — no auth, no CORS issues
function scoreboardUrl(league: TeamLeagueConfig): string {
  return `https://site.api.espn.com/apis/site/v2/sports/${league.espnPath}/scoreboard`;
}

interface ESPNAddress {
  city?: string;
  state?: string;
  country?: string;
}

interface ESPNCompetitor {
  homeAway: "home" | "away";
  score?: string;
  winner?: boolean;
  team: { id?: string; displayName: string; logo?: string };
}

interface ESPNDetail {
  scoringPlay?: boolean;
  type?: { id?: string; text?: string };
  clock?: { displayValue?: string };
  team?: { id?: string };
  athletesInvolved?: Array<{ displayName?: string }>;
}

interface ESPNEvent {
  id?: string;
  date?: string;
  status?: { displayClock?: string; type?: { name?: string; shortDetail?: string } };
  competitions?: Array<{
    competitors?: ESPNCompetitor[];
    venue?: { fullName?: string; address?: ESPNAddress };
    details?: ESPNDetail[];
  }>;
}

function lastName(full: string): string {
  const parts = full.trim().split(" ");
  return parts[parts.length - 1];
}

function normalize(name: string): string {
  return resolveAlias(
    name.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip combining diacritics (é->e, í->i, etc.)
      // streamed.pk suffixes women's teams with a standalone " W" ("Dallas Wings W")
      .replace(/\s+w$/, '')
      .replace(/[^a-z0-9]/g, '')
  );
}

export function teamKey(home: string, away: string): string {
  return `${normalize(home)}_${normalize(away)}`;
}

function espnDateStr(ms: number): string {
  // ESPN wants YYYYMMDD
  return new Date(ms).toISOString().split("T")[0].replace(/-/g, "");
}

function isFinishedStatus(statusName: string): boolean {
  return (
    statusName === "STATUS_FULL_TIME" ||
    statusName === "STATUS_FINAL" ||
    statusName === "STATUS_FINAL_PEN" ||
    statusName === "STATUS_FINAL_AET" ||
    statusName === "STATUS_FINAL_OT"
  );
}

// Parse ESPN displayClock into total elapsed minutes.
// "90'+7'" → 97, "120'+5'" → 125, "90:00" → 90, "120'" → 120.
function parseMatchMinutes(displayClock: string | undefined, fallback: number): number {
  if (!displayClock) return fallback;
  const withInjury = displayClock.match(/^(\d+)'\+(\d+)'/);
  if (withInjury) return parseInt(withInjury[1]) + parseInt(withInjury[2]);
  const colon = displayClock.match(/^(\d+):/);
  if (colon) return parseInt(colon[1]);
  const bare = displayClock.match(/^(\d+)'$/);
  if (bare) return parseInt(bare[1]);
  return fallback;
}

export async function getESPNMatchRange(
  league: TeamLeagueConfig,
  daysBack: number,
  daysAhead: number
): Promise<Omit<ESPNMatch, "sources">[]> {
  const now = Date.now();
  const startStr = espnDateStr(now - daysBack * 86_400_000);
  const endStr = espnDateStr(now + daysAhead * 86_400_000);

  let events: ESPNEvent[] = [];
  try {
    const res = await fetch(
      `${scoreboardUrl(league)}?dates=${startStr}-${endStr}&limit=100`,
      { next: { revalidate: 30 } }
    );
    if (res.ok) {
      const data = await res.json();
      events = (data.events ?? []) as ESPNEvent[];
    }
  } catch { /* return empty on network error */ }

  const results: Omit<ESPNMatch, "sources">[] = [];
  const seenIds = new Set<string>();

  for (const event of events) {
    if (!event.id || seenIds.has(event.id)) continue;
    seenIds.add(event.id);

    const comp = event.competitions?.[0];
    if (!comp) continue;

    const competitors = comp.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const statusName = event.status?.type?.name ?? "";
    const finished = isFinishedStatus(statusName);
    const postponed =
      statusName === "STATUS_POSTPONED" ||
      statusName === "STATUS_CANCELED" ||
      statusName === "STATUS_SUSPENDED";
    const isLive =
      !finished && !postponed && statusName !== "" && statusName !== "STATUS_SCHEDULED";
    const hasScore =
      !postponed &&
      statusName !== "STATUS_SCHEDULED" &&
      statusName !== "" &&
      home.score !== undefined &&
      away.score !== undefined;

    const venue = comp.venue;
    const city = venue?.address?.city;
    const region = venue?.address?.state ?? venue?.address?.country;
    const shortDetail = event.status?.type?.shortDetail;

    let hideAfterMs: number | undefined;
    if (finished && event.date) {
      const kickoffMs = new Date(event.date).getTime();
      const elapsedMs =
        league.detail === "goals"
          ? parseMatchMinutes(event.status?.displayClock, league.typicalDurationMins) * 60_000
          : league.typicalDurationMins * 60_000;
      hideAfterMs = kickoffMs + elapsedMs + 30 * 60_000;
    }

    const homeId = home.team.id;
    // Only filter penalty-type plays for shootout matches; in regular play a penalty kick is a real goal
    const isPenaltyShootout = statusName === "STATUS_FINAL_PEN";
    const goals: GoalEvent[] =
      league.detail !== "goals"
        ? []
        : (comp.details ?? [])
            .filter((d) => d.scoringPlay && !(isPenaltyShootout && d.type?.text?.toLowerCase().includes("penalty")))
            .map((d) => ({
              scorer: lastName(d.athletesInvolved?.[0]?.displayName ?? ""),
              minute: d.clock?.displayValue ?? "",
              team: (d.team?.id === homeId ? "home" : "away") as "home" | "away",
            }))
            .filter((g) => g.scorer);

    results.push({
      id: event.id,
      date: event.date ? new Date(event.date).getTime() : 0,
      homeTeam: { name: home.team.displayName, logo: home.team.logo, winner: home.winner },
      awayTeam: { name: away.team.displayName, logo: away.team.logo, winner: away.winner },
      score: hasScore
        ? { home: parseInt(home.score!, 10), away: parseInt(away.score!, 10) }
        : undefined,
      clock: isLive && shortDetail ? shortDetail : undefined,
      venue: venue?.fullName
        ? { stadium: venue.fullName, city: city ?? "", country: region ?? "" }
        : undefined,
      isFinished: finished,
      isLive,
      isPostponed: postponed,
      matchTime: finished ? (shortDetail ?? "FT") : undefined,
      hideAfterMs,
      goals,
    });
  }

  return results.sort((a, b) => a.date - b.date);
}
