import type { MatchSource } from "@/types";
import { teamKey } from "@/lib/espn";

// Manually added backup streams, keyed by normalized team pair.
// Place entries here to add extra stream badges for specific matches.
// url-bearing sources are shown first and are the default click target.
const CUSTOM: Record<string, MatchSource[]> = {
  [teamKey("Mexico", "Ecuador")]: [
    { source: "sportek", id: "mexico-ecuador", url: "https://live2.totalsportekx.to/Mexico-vs-Ecuador/70971" },
  ],
};

export function getCustomStreams(home: string, away: string): MatchSource[] {
  return CUSTOM[teamKey(home, away)] ?? [];
}
