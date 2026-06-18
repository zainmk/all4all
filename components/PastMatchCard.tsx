"use client";

import { useState } from "react";
import type { PastMatch } from "@/types";
import { TeamFlag } from "@/components/TeamFlag";

function TeamBadge({ badge, name, className = "w-10 h-7" }: { badge?: string; name?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!badge || failed) return <TeamFlag name={name} className={className} />;
  return (
    <img
      src={badge}
      alt={name ?? "Team"}
      className={`${className} object-contain shrink-0`}
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
      onError={() => setFailed(true)}
    />
  );
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}


function MatchTimeBadge({ matchTime }: { matchTime?: string }) {
  const label = matchTime ?? "FT";
  // Amber if match went beyond 90 minutes (injury time or extra time)
  const isOvertime = label !== "FT" && !label.startsWith("90'") && label !== "90:00";
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest shrink-0"
      style={{
        background: isOvertime ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${isOvertime ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.12)"}`,
        color: isOvertime ? "rgba(251,191,36,0.70)" : "rgba(255,255,255,0.40)",
      }}
    >
      {label}
    </span>
  );
}

export function PastMatchCard({ match }: { match: PastMatch }) {
  const { homeTeam, awayTeam, homeBadge, awayBadge, score, venue, date, matchTime } = match;

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
    <div className="w-full rounded-2xl" style={cardStyle}>

      {/* ── MOBILE layout (hidden at md+) ── */}
      <div className="md:hidden flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.60)" }}>{formatDate(date)}</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{formatTime(date)}</span>
          </div>
          <MatchTimeBadge matchTime={matchTime} />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <span className="text-sm font-bold truncate text-right uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.70)", fontFamily: "var(--font-sport)" }}>{homeTeam}</span>
            <TeamBadge badge={homeBadge} name={homeTeam} className="w-9 h-6" />
          </div>
          {scoreEl}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <TeamBadge badge={awayBadge} name={awayTeam} className="w-9 h-6" />
            <span className="text-sm font-bold truncate uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.70)", fontFamily: "var(--font-sport)" }}>{awayTeam}</span>
          </div>
        </div>

        {venue && (
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
            <span className="font-semibold" style={{ color: "rgba(255,255,255,0.50)" }}>
              {venue.city}{venue.country ? `, ${venue.country}` : ""}
            </span>
            {venue.stadium && <span> · {venue.stadium}</span>}
          </p>
        )}
      </div>

      {/* ── DESKTOP layout (hidden below md) ── */}
      <div
        className="hidden md:grid items-center gap-6 px-5 py-4"
        style={{ gridTemplateColumns: "1fr 2fr 1fr" }}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.60)" }}>{formatDate(date)}</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>{formatTime(date)}</span>
          {venue && (
            <div className="mt-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs font-bold leading-tight" style={{ color: "rgba(255,255,255,0.70)" }}>{venue.city}{venue.country ? `, ${venue.country}` : ""}</p>
              <p className="text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.30)" }}>{venue.stadium}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
            <span className="text-sm font-bold truncate text-right uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.70)", fontFamily: "var(--font-sport)" }}>{homeTeam}</span>
            <TeamBadge badge={homeBadge} name={homeTeam} className="w-10 h-7" />
          </div>
          {scoreEl}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <TeamBadge badge={awayBadge} name={awayTeam} className="w-10 h-7" />
            <span className="text-sm font-bold truncate uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.70)", fontFamily: "var(--font-sport)" }}>{awayTeam}</span>
          </div>
        </div>

        <div className="flex justify-end"><MatchTimeBadge matchTime={matchTime} /></div>
      </div>
    </div>
  );
}
