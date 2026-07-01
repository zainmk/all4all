import type { MatchSource } from "@/types";
import { teamKey } from "@/lib/espn";

// Manually added backup streams, keyed by normalized team pair.
// Place entries here to add extra stream badges for specific matches.
// url-bearing sources are shown first and are the default click target.
// Add entries here for one-off manual stream overrides keyed by team pair.
const CUSTOM: Record<string, MatchSource[]> = {};

export function getCustomStreams(home: string, away: string): MatchSource[] {
  return CUSTOM[teamKey(home, away)] ?? [];
}
