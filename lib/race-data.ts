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
import { getPpvFeed, ppvForRound, type PpvFeed } from "@/lib/ppv";
import { getPitsportFeed, pitsportForRound, type PitsportFeed } from "@/lib/pitsport";

/**
 * Fetches a race series' calendar (with stream links) and championship in one
 * place, so the page component doesn't need to know which provider backs which
 * league. Each series has its own results API, so this dispatches on league id.
 *
 * Stream links, best first: ppv.st and pitsport (each one link, to the session
 * that's live or next), then sportek's per-Grand-Prix page.
 */
export async function getRaceData(
  league: RaceLeagueConfig
): Promise<{ events: RaceEvent[]; championship: ChampionshipStatus | null }> {
  const feedsP = Promise.all([
    league.ppvKeywords ? getPpvFeed() : null,
    league.pitsportCompetition ? getPitsportFeed(league.pitsportCompetition) : null,
  ]);

  if (league.id === "f1") {
    const rounds = await getF1Season();
    const [events, championship, feeds] = await Promise.all([
      attachF1Sources(rounds, league.sportekPath),
      getF1Championship(rounds),
      feedsP,
    ]);
    return { events: withLiveStreams(events, feeds, league), championship };
  }

  // MotoGP
  const [rounds, streamUrls, feeds] = await Promise.all([
    getMotoGPSeason(),
    getSportekRaceIndex(league.sportekPath, SPORTEK_ROUND_ALIASES),
    feedsP,
  ]);
  const championship = await getMotoGPChampionship(rounds);
  const events: RaceEvent[] = rounds.map((r) => ({
    ...r,
    sources: sourcesForRound(r.shortName, streamUrls),
  }));
  return { events: withLiveStreams(events, feeds, league), championship };
}

/** Put each round's ppv.st and pitsport links ahead of its other sources (finished rounds skip them). */
function withLiveStreams(
  events: RaceEvent[],
  [ppv, pitsport]: [PpvFeed | null, PitsportFeed | null],
  league: RaceLeagueConfig
): RaceEvent[] {
  if (!ppv && !pitsport) return events;
  const now = Date.now();
  return events.map((e) =>
    e.isFinished
      ? e
      : {
          ...e,
          sources: [
            ...(ppv && league.ppvKeywords ? ppvForRound(ppv, league.ppvKeywords, e, now) : []),
            ...(pitsport ? pitsportForRound(pitsport, e, now) : []),
            ...e.sources,
          ],
        }
  );
}
