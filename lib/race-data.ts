import type { ChampionshipStatus, RaceEvent } from "@/types";
import type { RaceLeagueConfig } from "@/lib/leagues";
import {
  getMotoGPSeason,
  getMotoGPChampionship,
  SPORTEK_ROUND_ALIASES,
  sourcesForRound,
} from "@/lib/motogp";
import { getF1Season, getF1Championship, attachF1Sources } from "@/lib/f1";
import { getSportekRaceIndex } from "@/lib/sportek";
import { getLiveMatches, getTodayMatches } from "@/lib/api";
import { motorSportsMatches, motorStreamsForRound, type RaceSeries } from "@/lib/motor-streams";

/**
 * Fetches a race series' calendar (with stream links) and championship in one
 * place, so the page component doesn't need to know which provider backs which
 * league. Each series has its own results API, so this dispatches on league id.
 *
 * Two stream sources are merged per round: streamed.pk (per-class session feeds,
 * live during the weekend) and sportek (one page per Grand Prix). streamed.pk is
 * listed first since its badges are class-labelled and tend to be the live ones.
 */
export async function getRaceData(
  league: RaceLeagueConfig
): Promise<{ events: RaceEvent[]; championship: ChampionshipStatus | null }> {
  const series: RaceSeries = league.id === "f1" ? "f1" : "motogp";
  const motorP = Promise.all([getLiveMatches(), getTodayMatches()]).then(([live, today]) =>
    motorSportsMatches([...(live ?? []), ...(today ?? [])])
  );

  if (league.id === "f1") {
    const rounds = await getF1Season();
    const [withSportek, championship, motor] = await Promise.all([
      attachF1Sources(rounds, league.sportekPath),
      getF1Championship(rounds),
      motorP,
    ]);
    const events = withSportek.map((e) => ({
      ...e,
      sources: [...motorStreamsForRound(e, motor, series), ...e.sources],
    }));
    return { events, championship };
  }

  // MotoGP
  const [rounds, streamUrls, motor] = await Promise.all([
    getMotoGPSeason(),
    getSportekRaceIndex(league.sportekPath, SPORTEK_ROUND_ALIASES),
    motorP,
  ]);
  const championship = await getMotoGPChampionship(rounds);
  const events: RaceEvent[] = rounds.map((r) => ({
    ...r,
    sources: [...motorStreamsForRound(r, motor, series), ...sourcesForRound(r.shortName, streamUrls)],
  }));
  return { events, championship };
}
