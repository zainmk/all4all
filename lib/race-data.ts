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

/**
 * Fetches a race series' calendar (with stream links) and championship in one
 * place, so the page component doesn't need to know which provider backs which
 * league. Each series has its own results API, so this dispatches on league id.
 */
export async function getRaceData(
  league: RaceLeagueConfig
): Promise<{ events: RaceEvent[]; championship: ChampionshipStatus | null }> {
  if (league.id === "f1") {
    const rounds = await getF1Season();
    const [events, championship] = await Promise.all([
      attachF1Sources(rounds, league.sportekPath),
      getF1Championship(rounds),
    ]);
    return { events, championship };
  }

  // MotoGP
  const [rounds, streamUrls] = await Promise.all([
    getMotoGPSeason(),
    getSportekRaceIndex(league.sportekPath, SPORTEK_ROUND_ALIASES),
  ]);
  const championship = await getMotoGPChampionship(rounds);
  const events: RaceEvent[] = rounds.map((r) => ({
    ...r,
    sources: sourcesForRound(r.shortName, streamUrls),
  }));
  return { events, championship };
}
