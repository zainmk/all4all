import type { MatchSource } from "@/types";
import { teamKey } from "@/lib/espn";

// Manually added backup streams, keyed by normalized team pair. Entries show
// as extra badges on that match, listed ahead of every other source.
const CUSTOM: Record<string, MatchSource[]> = {};

export function getCustomStreams(home: string, away: string): MatchSource[] {
  return CUSTOM[teamKey(home, away)] ?? [];
}
