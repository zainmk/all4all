import { getESPNMatchRange, getStandings, getPlayoffBracket, teamKey } from "@/lib/espn";
import { getCustomStreams } from "@/lib/custom-streams";
import { getSportekIndex } from "@/lib/sportek";
import { getPpvFeed, ppvBuiltLink, ppvForMatch } from "@/lib/ppv";
import { LEAGUES, type LeagueId, type TeamLeagueConfig } from "@/lib/leagues";
import { MatchCard } from "@/components/MatchCard";
import { PastMatchCard } from "@/components/PastMatchCard";
import { TeamStandingsCard } from "@/components/TeamStandingsCard";
import { PlayoffBracket } from "@/components/PlayoffBracket";
import { PageShell } from "@/components/PageShell";
import type { ESPNMatch, MatchSource } from "@/types";

export async function LeaguePage({ leagueId }: { leagueId: LeagueId }) {
  const league = LEAGUES[leagueId] as TeamLeagueConfig;
  const now = Date.now();
  const range = league.matchWindow ?? { back: 3, ahead: 3 };

  // Core data in parallel
  const [espnMatches, sportek, ppvFeed, standings, bracket] = await Promise.all([
    getESPNMatchRange(league, range.back, range.ahead),
    league.useSportek ? getSportekIndex() : Promise.resolve(null),
    league.ppv ? getPpvFeed() : Promise.resolve(null),
    league.hasStandings ? getStandings(league) : Promise.resolve(null),
    // In the postseason this returns the bracket; it's null the rest of the year
    league.hasPlayoffBracket ? getPlayoffBracket(league) : Promise.resolve(null),
  ]);

  // ppv.st: its listing when the API answered; otherwise built links, but only
  // for leagues whose URL pattern has been verified (league.ppv.path)
  const ppvFor = (m: (typeof espnMatches)[number]): MatchSource[] => {
    if (!league.ppv) return [];
    if (ppvFeed) return ppvForMatch(ppvFeed, league.ppv.tag, m);
    return league.ppv.path ? ppvBuiltLink(league.ppv.path, m) : [];
  };

  // Combine all sources: custom → sportek → ppv.st
  const allMatches: ESPNMatch[] = espnMatches.map((m) => {
    const key = teamKey(m.homeTeam.name, m.awayTeam.name);
    const custom = getCustomStreams(m.homeTeam.name, m.awayTeam.name);
    const sportekUrl = sportek?.find(m.homeTeam.name, m.awayTeam.name);
    const sportekSources: MatchSource[] = sportekUrl
      ? [{ source: "sportek", id: `sportek-${key}`, url: sportekUrl }]
      : [];
    return { ...m, sources: [...custom, ...sportekSources, ...ppvFor(m)] };
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
        // In the postseason the bracket replaces the conference standings card.
        bracket ? (
          <PlayoffBracket bracket={bracket} league={league} />
        ) : standings ? (
          <TeamStandingsCard data={standings} league={league} />
        ) : null
      }
      emptyMessage="No matches found."
      nothingUpcomingMessage={`No live streams right now — check back closer to ${league.startNoun}.`}
    />
  );
}
