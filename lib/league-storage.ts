import { LEAGUE_ORDER, type LeagueId } from "@/lib/leagues";

export const LEAGUE_STORAGE_KEY = "all4all:league";

/** League the user last viewed, or null if there isn't a usable one stored. */
export function readStoredLeague(): LeagueId | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LEAGUE_STORAGE_KEY);
    // Validate against the known set — a stale id from a removed league (or
    // anything hand-edited into storage) must not decide where we navigate.
    return LEAGUE_ORDER.includes(value as LeagueId) ? (value as LeagueId) : null;
  } catch {
    // Safari private mode and blocked-storage settings throw on access
    return null;
  }
}

export function storeLeague(id: LeagueId): void {
  try {
    window.localStorage.setItem(LEAGUE_STORAGE_KEY, id);
  } catch {
    /* not being able to remember the choice is not worth breaking the page */
  }
}
