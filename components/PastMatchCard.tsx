"use client";

import { useState } from "react";
import type { ESPNMatch } from "@/types";
import type { TeamLeagueConfig } from "@/lib/leagues";
import { TeamFlag } from "@/components/TeamFlag";
import { TeamDetail, hasDetail } from "@/components/TeamDetail";

function TeamBadge({ logo, name, className = "w-10 h-7", fallback }: { logo?: string; name?: string; className?: string; fallback: "flag" | "initials" }) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) return <TeamFlag name={name} className={className} fallback={fallback} />;
  return (
    <img
      src={logo}
      alt={name ?? "Team"}
      className={`${className} object-contain shrink-0`}
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
      onError={() => setFailed(true)}
    />
  );
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ESPN's end-of-game label varies by sport: soccer gives "FT" / "AET" / "FT-PENS",
// basketball gives "Final" / "Final/OT" / "Final/2OT".
function endLabel(matchTime?: string): { label: string; isOvertime: boolean } {
  const upper = (matchTime ?? "FT").toUpperCase().trim();
  if (upper === "FT-PENS" || upper === "PENS") return { label: "PEN", isOvertime: false };
  if (upper === "FINAL" || upper === "FT") return { label: "FT", isOvertime: false };
  const ot = upper.match(/^FINAL\/(\d*OT)$/);
  if (ot) return { label: ot[1], isOvertime: true };
  return { label: matchTime ?? "FT", isOvertime: true };
}

function MatchTimeBadge({ matchTime, accent }: { matchTime?: string; accent: string }) {
  const { label, isOvertime } = endLabel(matchTime);
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest shrink-0"
      style={{
        background: isOvertime ? `rgba(${accent},0.08)` : "rgba(255,255,255,0.06)",
        border: `1px solid ${isOvertime ? `rgba(${accent},0.25)` : "rgba(255,255,255,0.12)"}`,
        color: isOvertime ? `rgba(${accent},0.70)` : "rgba(255,255,255,0.40)",
      }}
    >
      {label}
    </span>
  );
}

export function PastMatchCard({ match, league }: { match: ESPNMatch; league: TeamLeagueConfig }) {
  const score = match.score ?? { home: 0, away: 0 };

  const scoreEl = (
    <div
      className="flex items-center justify-center px-3 py-1 rounded-lg shrink-0"
      style={{
        background: "rgba(0,0,0,0.45)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
      }}
    >
      <span
        className="text-xl font-black tabular-nums"
        style={{ fontFamily: "var(--font-sport)", color: "#ffffff", letterSpacing: "0.05em" }}
      >
        {score.home} <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.30)" }}>-</span> {score.away}
      </span>
    </div>
  );

  const cardStyle = {
    background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
    border: "1px solid rgba(255,255,255,0.06)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    opacity: 0.65,
  };

  return (
    <div
      className="w-full rounded-2xl"
      style={cardStyle}
    >
      {/* ── MOBILE layout ── */}
      <div className="md:hidden flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.60)" }}>{formatDate(match.date)}</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{formatTime(match.date)}</span>
          </div>
          <MatchTimeBadge matchTime={match.matchTime} accent={league.accent} />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
              <span className="text-sm font-bold truncate text-right uppercase tracking-wide" style={{ color: match.homeTeam.winner ? "rgba(255,255,255,0.95)" : match.awayTeam.winner ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.70)", fontFamily: "var(--font-sport)" }}>{match.homeTeam.name}</span>
              <TeamBadge logo={match.homeTeam.logo} name={match.homeTeam.name} className="w-9 h-6" fallback={league.teamFallback} />
            </div>
            {scoreEl}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <TeamBadge logo={match.awayTeam.logo} name={match.awayTeam.name} className="w-9 h-6" fallback={league.teamFallback} />
              <span className="text-sm font-bold truncate uppercase tracking-wide" style={{ color: match.awayTeam.winner ? "rgba(255,255,255,0.95)" : match.homeTeam.winner ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.70)", fontFamily: "var(--font-sport)" }}>{match.awayTeam.name}</span>
            </div>
          </div>
          {hasDetail(league, match) && (
            <div className="flex gap-2 text-[10px]">
              <div className="flex-1 flex flex-col items-end gap-px">
                <TeamDetail league={league} side="home" goals={match.goals} primary="rgba(255,255,255,0.35)" secondary="rgba(255,255,255,0.20)" />
              </div>
              <div className="shrink-0" style={{ visibility: "hidden" }}>{scoreEl}</div>
              <div className="flex-1 flex flex-col items-start gap-px">
                <TeamDetail league={league} side="away" goals={match.goals} primary="rgba(255,255,255,0.35)" secondary="rgba(255,255,255,0.20)" />
              </div>
            </div>
          )}
        </div>

        {match.venue && (
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
            <span className="font-semibold" style={{ color: "rgba(255,255,255,0.50)" }}>
              {match.venue.city}{match.venue.country ? `, ${match.venue.country}` : ""}
            </span>
            {match.venue.stadium && <span> · {match.venue.stadium}</span>}
          </p>
        )}
      </div>

      {/* ── DESKTOP layout ── */}
      <div
        className="hidden md:grid items-center gap-6 px-5 py-4"
        style={{ gridTemplateColumns: "1fr 2fr 1fr" }}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.60)" }}>{formatDate(match.date)}</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>{formatTime(match.date)}</span>
          {match.venue && (
            <div className="mt-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs font-bold leading-tight" style={{ color: "rgba(255,255,255,0.70)" }}>{match.venue.city}{match.venue.country ? `, ${match.venue.country}` : ""}</p>
              <p className="text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.30)" }}>{match.venue.stadium}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
              <span className="text-sm font-bold truncate text-right uppercase tracking-wide" style={{ color: match.homeTeam.winner ? "rgba(255,255,255,0.95)" : match.awayTeam.winner ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.70)", fontFamily: "var(--font-sport)" }}>{match.homeTeam.name}</span>
              <TeamBadge logo={match.homeTeam.logo} name={match.homeTeam.name} className="w-10 h-7" fallback={league.teamFallback} />
            </div>
            {scoreEl}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <TeamBadge logo={match.awayTeam.logo} name={match.awayTeam.name} className="w-10 h-7" fallback={league.teamFallback} />
              <span className="text-sm font-bold truncate uppercase tracking-wide" style={{ color: match.awayTeam.winner ? "rgba(255,255,255,0.95)" : match.homeTeam.winner ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.70)", fontFamily: "var(--font-sport)" }}>{match.awayTeam.name}</span>
            </div>
          </div>
          {hasDetail(league, match) && (
            <div className="flex gap-3 text-[10px]">
              <div className="flex-1 flex flex-col items-end gap-px">
                <TeamDetail league={league} side="home" goals={match.goals} primary="rgba(255,255,255,0.35)" secondary="rgba(255,255,255,0.20)" />
              </div>
              <div className="shrink-0" style={{ visibility: "hidden" }}>{scoreEl}</div>
              <div className="flex-1 flex flex-col items-start gap-px">
                <TeamDetail league={league} side="away" goals={match.goals} primary="rgba(255,255,255,0.35)" secondary="rgba(255,255,255,0.20)" />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end"><MatchTimeBadge matchTime={match.matchTime} accent={league.accent} /></div>
      </div>
    </div>
  );
}
