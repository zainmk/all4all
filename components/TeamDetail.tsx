"use client";

import type { ESPNMatch } from "@/types";
import type { TeamLeagueConfig } from "@/lib/leagues";

/**
 * The detail lines rendered under one team's name — goal scorers, for the
 * leagues that have them. Rendered inside a flex-col that already sets the
 * alignment for its side.
 */
export function TeamDetail({
  league,
  side,
  goals,
  primary,
  secondary,
}: {
  league: TeamLeagueConfig;
  side: "home" | "away";
  goals: ESPNMatch["goals"];
  /** Colour for the scorer name */
  primary: string;
  /** Colour for the minute */
  secondary: string;
}) {
  if (league.detail !== "goals") return null;
  return (
    <>
      {goals
        .filter((g) => g.team === side)
        .map((g, i) => (
          <span key={i} style={{ color: primary }}>
            {g.scorer} <span style={{ color: secondary }}>{g.minute}</span>
          </span>
        ))}
    </>
  );
}

/** Whether this match has any detail worth reserving vertical space for. */
export function hasDetail(league: TeamLeagueConfig, match: ESPNMatch): boolean {
  return league.detail === "goals" && match.goals.length > 0;
}
