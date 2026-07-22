import { getRaceData } from "@/lib/race-data";
import { LEAGUES, type LeagueId, type RaceLeagueConfig } from "@/lib/leagues";
import { PageShell } from "@/components/PageShell";
import { RaceCard } from "@/components/RaceCard";
import { StandingsCard } from "@/components/StandingsCard";
import type { RaceEvent } from "@/types";

export async function RacePage({ leagueId }: { leagueId: LeagueId }) {
  const league = LEAGUES[leagueId] as RaceLeagueConfig;
  const now = Date.now();

  const { events, championship } = await getRaceData(league);

  // A weekend stays "current" until the day after it ends
  const past = events.filter((e) => e.isFinished && now > e.dateEnd + 86_400_000);
  const upcoming = events.filter((e) => !past.includes(e));
  const isUnderWay = (e: RaceEvent) =>
    now >= e.dateStart && now <= e.dateEnd + 86_400_000;

  return (
    <PageShell
      leagueId={leagueId}
      past={past.map((e) => (
        <div key={e.id} id={`round-${e.shortName}`} style={{ scrollMarginTop: "96px" }}>
          <RaceCard event={e} league={league} isPast isLive={false} />
        </div>
      ))}
      upcoming={upcoming.map((e) => (
        <div key={e.id} id={`round-${e.shortName}`} style={{ scrollMarginTop: "96px" }}>
          <RaceCard event={e} league={league} isPast={false} isLive={isUnderWay(e)} />
        </div>
      ))}
      beforeNow={
        championship ? <StandingsCard status={championship} league={league} /> : null
      }
      emptyMessage="No races found."
      nothingUpcomingMessage="Season complete — the next calendar isn't out yet."
    />
  );
}
