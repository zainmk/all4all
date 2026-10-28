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

/**
 * Fetches a race series' calendar (with stream links) and championship in one
 * place, so the page component doesn't need to know which provider backs which
 * league. Each series has its own results API, so this dispatches on league id.
 *
 * Stream links: ppv.st's listing for the weekend first (one link, to the session
 * that's live or next), then sportek's per-Grand-Prix page.
 */
export async function getRaceData(
  league: RaceLeagueConfig
): Promise<{ events: RaceEvent[]; championship: ChampionshipStatus | null }> {
  const feedP = league.ppvKeywords ? getPpvFeed() : Promise.resolve(null);

  if (league.id === "f1") {
    const rounds = await getF1Season();
    const [events, championship, feed] = await Promise.all([
      attachF1Sources(rounds, league.sportekPath),
      getF1Championship(rounds),
      feedP,
    ]);
    return { events: withPpv(events, feed, league), championship };
  }

  // MotoGP
  const [rounds, streamUrls, feed] = await Promise.all([
    getMotoGPSeason(),
    getSportekRaceIndex(league.sportekPath, SPORTEK_ROUND_ALIASES),
    feedP,
  ]);
  const championship = await getMotoGPChampionship(rounds);
  const events: RaceEvent[] = rounds.map((r) => ({
    ...r,
    sources: sourcesForRound(r.shortName, streamUrls),
  }));
  return { events: withPpv(events, feed, league), championship };
}

/** Put the round's ppv.st link ahead of its other sources (finished rounds skip it). */
function withPpv(events: RaceEvent[], feed: PpvFeed | null, league: RaceLeagueConfig): RaceEvent[] {
  if (!feed || !league.ppvKeywords) return events;
  const now = Date.now();
  const keywords = league.ppvKeywords;
  return events.map((e) =>
    e.isFinished ? e : { ...e, sources: [...ppvForRound(feed, keywords, e, now), ...e.sources] }
  );
}
