import type { Match, MatchEnrichment, PastMatch } from "@/types";
import { resolveAlias } from "@/lib/team-aliases";

// ESPN public scoreboard API — no auth, no CORS issues
const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

interface ESPNAddress {
  city?: string;
  state?: string;
  country?: string;
}

interface ESPNCompetitor {
  homeAway: "home" | "away";
  score?: string;
  team: { displayName: string; logo?: string };
}

interface ESPNEvent {
  id?: string;
  date?: string;
  status?: { type?: { name?: string; shortDetail?: string } };
  competitions?: Array<{
    competitors?: ESPNCompetitor[];
    venue?: { fullName?: string; address?: ESPNAddress };
  }>;
}

function normalize(name: string): string {
  return resolveAlias(name.toLowerCase().replace(/[^a-z0-9]/g, ""));
}

function teamKey(home: string, away: string): string {
  return `${normalize(home)}_${normalize(away)}`;
}

function espnDateStr(ms: number): string {
  // ESPN wants YYYYMMDD
  return new Date(ms).toISOString().split("T")[0].replace(/-/g, "");
}

async function fetchESPNEvents(dateStr: string): Promise<ESPNEvent[]> {
  try {
    const res = await fetch(`${ESPN_BASE}?dates=${dateStr}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events ?? []) as ESPNEvent[];
  } catch {
    return [];
  }
}

export async function getEnrichments(
  matches: Match[]
): Promise<Map<string, MatchEnrichment>> {
  const enrichments = new Map<string, MatchEnrichment>();
  if (matches.length === 0) return enrichments;

  // Group streamed.pk matches by ESPN date string.
  // Also include the previous UTC day per match — late US evening kickoffs
  // (e.g. 9 PM ET = 1 AM UTC next day) are indexed by ESPN under the local date.
  const uniqueDates = new Set<string>();
  for (const m of matches) {
    const ds = espnDateStr(m.date);
    uniqueDates.add(ds);
    uniqueDates.add(espnDateStr(m.date - 86_400_000)); // also query day before in UTC
  }

  // Fetch ESPN data for each unique date in parallel
  const espnByDate = await Promise.all(
    Array.from(uniqueDates).map(async (ds) => ({ ds, events: await fetchESPNEvents(ds) }))
  );

  // Build team-key → enrichment map from all ESPN events
  const espnLookup = new Map<
    string,
    { score?: { home: number; away: number }; clock?: string; venue?: MatchEnrichment["venue"] }
  >();

  for (const { events } of espnByDate) {
    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const competitors = comp.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === "home");
      const away = competitors.find((c) => c.homeAway === "away");
      if (!home || !away) continue;

      const key = teamKey(home.team.displayName, away.team.displayName);
      const statusName = event.status?.type?.name ?? "";
      const isActive =
        statusName !== "" &&
        statusName !== "STATUS_SCHEDULED" &&
        statusName !== "STATUS_FULL_TIME" &&
        statusName !== "STATUS_FINAL";
      const hasScore =
        statusName !== "STATUS_SCHEDULED" &&
        statusName !== "" &&
        home.score !== undefined &&
        away.score !== undefined;

      const venue = comp.venue;
      const city = venue?.address?.city;
      const region = venue?.address?.state ?? venue?.address?.country;
      const shortDetail = event.status?.type?.shortDetail;

      espnLookup.set(key, {
        score: hasScore
          ? { home: parseInt(home.score!, 10), away: parseInt(away.score!, 10) }
          : undefined,
        clock: isActive && shortDetail ? shortDetail : undefined,
        venue: venue?.fullName
          ? {
              stadium: venue.fullName,
              city: city ?? "",
              country: region ?? "",
            }
          : undefined,
      });
    }
  }

  // Match each streamed.pk event to ESPN data by team names
  for (const m of matches) {
    const home = m.teams?.home?.name;
    const away = m.teams?.away?.name;
    if (!home || !away) continue;

    const espn = espnLookup.get(teamKey(home, away));
    if (!espn) continue;

    enrichments.set(m.id, {
      score: espn.score,
      clock: espn.clock,
      venue: espn.venue,
    });
  }

  return enrichments;
}

export async function getPastMatches(days = 1): Promise<PastMatch[]> {
  const dateStrings = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (i + 1) * 86_400_000);
    return d.toISOString().split("T")[0].replace(/-/g, "");
  });

  const allEvents = await Promise.all(dateStrings.map(fetchESPNEvents));

  const results: PastMatch[] = [];

  for (const events of allEvents) {
    for (const event of events) {
      if (event.status?.type?.name !== "STATUS_FULL_TIME") continue;

      const comp = event.competitions?.[0];
      if (!comp) continue;

      const competitors = comp.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === "home");
      const away = competitors.find((c) => c.homeAway === "away");
      if (!home || !away) continue;

      const homeScore = parseInt(home.score ?? "", 10);
      const awayScore = parseInt(away.score ?? "", 10);
      if (isNaN(homeScore) || isNaN(awayScore)) continue;

      const venue = comp.venue;
      const city = venue?.address?.city;
      const region = venue?.address?.state ?? venue?.address?.country;

      results.push({
        id: event.id ?? `${home.team.displayName}-${away.team.displayName}`,
        date: event.date ? new Date(event.date).getTime() : 0,
        homeTeam: home.team.displayName,
        awayTeam: away.team.displayName,
        homeBadge: home.team.logo,
        awayBadge: away.team.logo,
        score: { home: homeScore, away: awayScore },
        venue: venue?.fullName
          ? { stadium: venue.fullName, city: city ?? "", country: region ?? "" }
          : undefined,
      });
    }
  }

  return results.sort((a, b) => a.date - b.date);
}
