"use client";

import { useEffect } from "react";
import { storeLeague } from "@/lib/league-storage";
import type { LeagueId } from "@/lib/leagues";

/** Records the league being viewed so "/" can return here next visit. */
export function RememberLeague({ leagueId }: { leagueId: LeagueId }) {
  useEffect(() => {
    storeLeague(leagueId);
  }, [leagueId]);

  return null;
}
