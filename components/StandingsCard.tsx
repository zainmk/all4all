"use client";

import { useState } from "react";
import type { ChampionshipStatus, StandingEntry } from "@/types";
import type { RaceLeagueConfig } from "@/lib/leagues";

const VISIBLE_BY_DEFAULT = 5;
const PODIUM_COLORS: Record<number, string> = { 1: "#fbbf24", 2: "#cbd5e1", 3: "#d97706" };

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function Trophy({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M7 4h10v5a5 5 0 0 1-10 0V4Z"
        fill={color}
      />
      <path
        d="M7 5H5a2 2 0 0 0 0 4h2M17 5h2a2 2 0 0 1 0 4h-2"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 14v3m-3 3h6m-6 0a3 3 0 0 1 3-3 3 3 0 0 1 3 3"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** "↑2" / "↓1" / "–" for movement at the last round. */
function PositionChange({ change }: { change: number }) {
  if (change === 0) {
    return <span className="w-5 shrink-0 text-center" style={{ color: "rgba(255,255,255,0.18)" }}>–</span>;
  }
  const up = change > 0;
  return (
    <span
      className="w-5 shrink-0 text-center tabular-nums font-bold"
      style={{ color: up ? "rgba(52,211,153,0.85)" : "rgba(239,68,68,0.75)" }}
      title={`${up ? "Up" : "Down"} ${Math.abs(change)} since the last round`}
    >
      {up ? "▲" : "▼"}{Math.abs(change)}
    </span>
  );
}

/** Finishes at the last few rounds — the quickest read on current form. */
function RecentForm({ recent }: { recent: StandingEntry["recent"] }) {
  if (recent.length === 0) return null;
  return (
    <div className="hidden lg:flex items-center gap-1 shrink-0">
      {recent.map(({ round, position }) => (
        <span
          key={round}
          className="w-6 h-5 rounded flex items-center justify-center text-[10px] font-bold tabular-nums"
          style={{
            background: position === null ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
            color: position === null
              ? "rgba(255,255,255,0.20)"
              : PODIUM_COLORS[position] ?? "rgba(255,255,255,0.55)",
          }}
          title={position === null ? `${round}: did not finish` : `${round}: finished P${position}`}
        >
          {position ?? "–"}
        </span>
      ))}
    </div>
  );
}

export function StandingsCard({
  status,
  league,
}: {
  status: ChampionshipStatus;
  league: RaceLeagueConfig;
}) {
  const [expanded, setExpanded] = useState(false);
  const { standings, roundsComplete, roundsTotal, nextRound, year } = status;

  if (standings.length === 0) return null;

  const shown = expanded ? standings : standings.slice(0, VISIBLE_BY_DEFAULT);
  const seasonOver = roundsComplete >= roundsTotal;

  return (
    <div
      className="w-full rounded-2xl"
      style={{
        background: `linear-gradient(135deg, rgba(${league.accent},0.10) 0%, rgba(255,255,255,0.03) 100%)`,
        border: `1px solid rgba(${league.accent},0.22)`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: `0 4px 32px rgba(${league.accent},0.08), 0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      <div className="px-4 sm:px-5 py-4 flex flex-col gap-3">
        {/* Heading */}
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2
            className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2"
            style={{ color: `rgba(${league.accent},0.85)` }}
          >
            <Trophy color={`rgba(${league.accent},0.9)`} />
            {/* One expression — JSX drops the literal space between {year} and
                the text that follows it, rendering "2026Riders'". */}
            {`${year} MotoGP Riders’ Championship`}
          </h2>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.45)" }}>
            {seasonOver
              ? `Season complete · ${roundsTotal} rounds`
              : `Round ${roundsComplete} of ${roundsTotal}`}
          </span>
        </div>

        {/* Table */}
        <div className="flex flex-col">
          {shown.map((s) => (
            <div
              key={s.position}
              className="flex items-center gap-2 sm:gap-3 py-1.5 text-[11px]"
              style={{ borderTop: s.position === 1 ? "none" : "1px solid rgba(255,255,255,0.05)" }}
            >
              <span
                className="font-black tabular-nums w-5 shrink-0 text-right"
                style={{ color: PODIUM_COLORS[s.position] ?? "rgba(255,255,255,0.45)" }}
              >
                {s.position}
              </span>
              <PositionChange change={s.positionChange} />
              <span
                className="hidden sm:inline tabular-nums font-bold w-6 shrink-0 text-right"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                {s.riderNumber}
              </span>
              <span
                className="text-sm sm:text-base font-bold truncate uppercase tracking-wide min-w-0"
                style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}
              >
                {s.rider}
              </span>
              <span className="hidden md:block truncate min-w-0 flex-1" style={{ color: "rgba(255,255,255,0.30)" }}>
                {s.team}
              </span>
              <span
                className="hidden xl:inline tabular-nums shrink-0"
                style={{ color: "rgba(255,255,255,0.30)" }}
                title={`${s.raceWins} race wins · ${s.podiums} podiums · ${s.sprintWins} sprint wins`}
              >
                {s.raceWins}W · {s.podiums}P
              </span>
              <RecentForm recent={s.recent} />
              <span
                className="ml-auto md:ml-0 tabular-nums font-black shrink-0 w-10 text-right"
                style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}
              >
                {s.points}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          {standings.length > VISIBLE_BY_DEFAULT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="text-[10px] font-black uppercase tracking-widest py-1"
              style={{ color: `rgba(${league.accent},0.75)` }}
            >
              {expanded ? "Show top 5" : `All ${standings.length} riders`}
            </button>
          )}
          {nextRound && (
            <span className="text-[10px] uppercase tracking-widest font-bold ml-auto" style={{ color: "rgba(255,255,255,0.35)" }}>
              Next · {nextRound.name} · {formatDate(nextRound.dateStart)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
