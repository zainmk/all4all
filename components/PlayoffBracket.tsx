"use client";

import { useState } from "react";
import type { BracketSeries, BracketTeam, PlayoffBracket } from "@/types";
import type { TeamLeagueConfig } from "@/lib/leagues";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "NY wins series 2-0" → "NY wins 2-0"; "Series starts 10/4" → "Series begins Oct 4". */
function prettySummary(summary: string): string {
  const starts = summary.match(/Series starts (\d{1,2})\/(\d{1,2})/i);
  if (starts) {
    const mon = MONTHS[parseInt(starts[1], 10) - 1] ?? "";
    return `Series begins ${mon} ${parseInt(starts[2], 10)}`;
  }
  return summary.replace(/\s+series\s+/i, " ");
}

/** FINAL once decided; otherwise GAME N (next game in the series). */
function statusChip(s: BracketSeries): string {
  if (s.completed) return "FINAL";
  const played = s.teams[0].wins + s.teams[1].wins;
  return `GAME ${played + 1}`;
}

function TeamLogo({ team }: { team: BracketTeam }) {
  const [failed, setFailed] = useState(false);
  if (team.tbd || !team.logo || failed) {
    return (
      <span
        className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[8px] font-black"
        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}
      >
        {team.tbd ? "" : team.abbrev.slice(0, 3)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={team.logo} alt="" className="w-5 h-5 object-contain shrink-0" onError={() => setFailed(true)} />;
}

function TeamRow({ team, started }: { team: BracketTeam; started: boolean }) {
  const dim = !team.tbd && started && !team.isWinner;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="w-3 shrink-0 text-right tabular-nums text-[10px] font-bold"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        {team.seed ?? ""}
      </span>
      <TeamLogo team={team} />
      <span
        className="flex-1 min-w-0 truncate text-[12px] font-bold uppercase tracking-wide"
        style={{
          color: team.tbd ? "rgba(255,255,255,0.3)" : dim ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.92)",
          fontFamily: "var(--font-sport)",
        }}
      >
        {team.tbd ? "TBD" : team.name}
      </span>
      {started && !team.tbd && (
        <span
          className="shrink-0 tabular-nums text-[12px] font-black"
          style={{ color: team.isWinner ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)" }}
        >
          {team.wins}
        </span>
      )}
    </div>
  );
}

function SeriesBox({ series, accent }: { series: BracketSeries; accent: string }) {
  const started = series.teams[0].wins + series.teams[1].wins > 0 || series.completed;
  return (
    <div
      className="rounded-xl px-3 py-2.5 flex flex-col gap-2"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex flex-col gap-1.5">
        <TeamRow team={series.teams[0]} started={started} />
        <TeamRow team={series.teams[1]} started={started} />
      </div>
      <div className="flex items-center justify-between gap-2 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <span
          className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{
            background: series.completed ? "rgba(255,255,255,0.08)" : `rgba(${accent},0.14)`,
            color: series.completed ? "rgba(255,255,255,0.55)" : `rgba(${accent},0.95)`,
          }}
        >
          {statusChip(series)}
        </span>
        <span className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
          {prettySummary(series.summary)}
        </span>
      </div>
    </div>
  );
}

/** Column of series for one round, vertically distributed for bracket alignment. */
function RoundColumn({
  title,
  bestOf,
  series,
  accent,
}: {
  title: string;
  bestOf: number;
  series: BracketSeries[];
  accent: string;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: `rgba(${accent},0.85)` }}>
          {title}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
          Best of {bestOf}
        </span>
      </div>
      {/* justify-around spreads boxes so each round's items align between their
          feeders: 4 → eighths, 2 → quarters, 1 → centre. */}
      <div className="flex-1 flex flex-col justify-around gap-3">
        {series.map((s) => (
          <SeriesBox key={`${s.round}-${s.slot}`} series={s} accent={accent} />
        ))}
      </div>
    </div>
  );
}

const TBD_TEAM: BracketTeam = { id: "", abbrev: "", name: "TBD", wins: 0, isWinner: false, tbd: true };

export function PlayoffBracket({
  bracket,
  league,
}: {
  bracket: PlayoffBracket;
  league: TeamLeagueConfig;
}) {
  const { accent } = league;
  // Always render a Finals box, even before the matchup is set.
  const finals: BracketSeries[] =
    bracket.final.length > 0
      ? bracket.final
      : [{ round: "final", bestOf: 7, teams: [TBD_TEAM, TBD_TEAM], summary: "", completed: false, slot: 0 }];

  const columns: Array<{ title: string; bestOf: number; series: BracketSeries[] }> = [
    { title: "First Round", bestOf: 3, series: bracket.first },
    { title: "Semifinals", bestOf: 5, series: bracket.semi },
    { title: "Finals", bestOf: 7, series: finals },
  ];

  return (
    <div
      className="w-full rounded-2xl"
      style={{
        background: `linear-gradient(135deg, rgba(${accent},0.10) 0%, rgba(255,255,255,0.03) 100%)`,
        border: `1px solid rgba(${accent},0.22)`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: `0 4px 32px rgba(${accent},0.08), 0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      <div className="px-4 sm:px-5 py-4 flex flex-col gap-3">
        <h2 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: `rgba(${accent},0.85)` }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" aria-hidden="true">
            <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" fill={`rgba(${accent},0.9)`} />
            <path d="M7 5H5a2 2 0 0 0 0 4h2M17 5h2a2 2 0 0 1 0 4h-2" stroke={`rgba(${accent},0.9)`} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M12 14v3m-3 3h6m-6 0a3 3 0 0 1 3-3 3 3 0 0 1 3 3" stroke={`rgba(${accent},0.9)`} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {`${bracket.year} Playoffs`}
        </h2>

        {/* Desktop: three aligned columns form the bracket. Mobile: stacked rounds. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 md:min-h-[320px]">
          {columns.map((c) => (
            <RoundColumn key={c.title} title={c.title} bestOf={c.bestOf} series={c.series} accent={accent} />
          ))}
        </div>
      </div>
    </div>
  );
}
