import { getLiveMatches, getTodayMatches, filterByCategory } from "@/lib/api";
import { getESPNMatchRange, getStandings, teamKey } from "@/lib/espn";
import { getCustomStreams } from "@/lib/custom-streams";
import { getFootybiteStreams } from "@/lib/footybite";
import { getSportekIndex } from "@/lib/sportek";
import { LEAGUES, type LeagueId, type TeamLeagueConfig } from "@/lib/leagues";
import { MatchCard } from "@/components/MatchCard";
import { PastMatchCard } from "@/components/PastMatchCard";
import { TeamStandingsCard } from "@/components/TeamStandingsCard";
import { PageShell } from "@/components/PageShell";
import type { ESPNMatch, MatchSource } from "@/types";

export async function LeaguePage({ leagueId }: { leagueId: LeagueId }) {
  const league = LEAGUES[leagueId] as TeamLeagueConfig;
  const now = Date.now();

  // Phase 1: core data in parallel
  const [espnMatches, liveAll, todayAll, sportek, standings] = await Promise.all([
    getESPNMatchRange(league, 3, 3),
    getLiveMatches(),
    getTodayMatches(),
    getSportekIndex(),
    league.hasStandings ? getStandings(league) : Promise.resolve(null),
  ]);

  const streamsDown = liveAll === null && todayAll === null;

  // Build team-key → sources lookup from streamed.pk (live + today)
  const streamMatches = filterByCategory(
    [...(liveAll ?? []), ...(todayAll ?? [])],
    league.streamCategory
  );
  const streamLookup = new Map<string, MatchSource[]>();
  for (const m of streamMatches) {
    const home = m.teams?.home?.name;
    const away = m.teams?.away?.name;
    if (!home || !away) continue;
    const key = teamKey(home, away);
    const existing = streamLookup.get(key) ?? [];
    for (const s of m.sources) {
      if (s.source !== "admin" && s.source !== "echo") continue;
      if (!existing.some((e) => e.source === s.source && e.id === s.id)) existing.push(s);
    }
    streamLookup.set(key, existing);
  }

  // Phase 2: fetch footybite streams for active/upcoming matches in parallel
  // (past matches don't need streams; future matches return empty quickly and are cached)
  const activeEspn = espnMatches.filter(
    (m) => !m.isFinished || (m.hideAfterMs !== undefined && now < m.hideAfterMs)
  );
  const footybiteResults = league.useFootybite
    ? await Promise.all(
        activeEspn.map(async (m) => ({
          key: teamKey(m.homeTeam.name, m.awayTeam.name),
          sources: await getFootybiteStreams(m.homeTeam.name, m.awayTeam.name),
        }))
      )
    : [];
  const footybiteMap = new Map(footybiteResults.map((r) => [r.key, r.sources]));

  // Combine all sources: custom → footybite → sportek → streamed.pk
  const allMatches: ESPNMatch[] = espnMatches.map((m) => {
    const key = teamKey(m.homeTeam.name, m.awayTeam.name);
    const custom = getCustomStreams(m.homeTeam.name, m.awayTeam.name);
    const footybite = footybiteMap.get(key) ?? [];
    const sportekUrl = sportek.find(m.homeTeam.name, m.awayTeam.name);
    const sportekSources: MatchSource[] = sportekUrl
      ? [{ source: "sportek", id: `sportek-${key}`, url: sportekUrl }]
      : [];
    const streamed = streamLookup.get(key) ?? [];
    return { ...m, sources: [...custom, ...footybite, ...sportekSources, ...streamed] };
  });

  const past = allMatches.filter(
    (m) => m.isFinished && (m.hideAfterMs === undefined || now >= m.hideAfterMs) && m.score !== undefined
  );
  const active = allMatches.filter(
    (m) =>
      // A postponed game has no new date attached, so drop it once its slot has passed
      (!m.isPostponed || m.date > now) &&
      (!m.isFinished || (m.hideAfterMs !== undefined && now < m.hideAfterMs))
  );

  return (
    <PageShell
      leagueId={leagueId}
      past={past.map((m) => (
        <div key={m.id} id={`match-${m.id}`} style={{ scrollMarginTop: "96px" }}>
          <PastMatchCard match={m} league={league} />
        </div>
      ))}
      upcoming={active.map((m) => (
        <div key={m.id} id={`match-${m.id}`} style={{ scrollMarginTop: "96px" }}>
          <MatchCard
            match={m}
            league={league}
            isLive={m.isLive || (m.isFinished && m.hideAfterMs !== undefined && now < m.hideAfterMs)}
          />
        </div>
      ))}
      beforeNow={
        standings ? <TeamStandingsCard data={standings} league={league} /> : null
      }
      emptyMessage="No matches found."
      nothingUpcomingMessage={
        streamsDown
          ? "Streams unavailable — streamed.pk may be down. Retrying shortly."
          : `No live streams right now — check back closer to ${league.startNoun}.`
      }
    />
  );
}
