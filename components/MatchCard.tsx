"use client";

import { useEffect, useState } from "react";
import type { ESPNMatch, MatchSource } from "@/types";
import type { TeamLeagueConfig } from "@/lib/leagues";
import { embedUrl } from "@/lib/api";
import { TeamFlag } from "@/components/TeamFlag";
import { TeamDetail, hasDetail } from "@/components/TeamDetail";

function displayName(name: string): string {
  return /winner|round of/i.test(name) ? "TBD" : name;
}

/**
 * First source matching `name`. On desktop an "admin" pick skips url-bearing
 * entries, which are manual overrides meant to be reached from their own badge.
 */
function pick(sources: MatchSource[], name: string, strictAdmin: boolean): MatchSource | undefined {
  if (name === "admin" && strictAdmin) return sources.find((s) => s.source === "admin" && !s.url);
  return sources.find((s) => s.source === name);
}

function TeamBadge({ logo, name, className = "w-10 h-10", fallback }: { logo?: string; name?: string; className?: string; fallback: "flag" | "initials" }) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) return <TeamFlag name={name} className={className} fallback={fallback} />;
  return (
    <img
      src={logo}
      alt={name ?? "Team"}
      className={`${className} object-contain shrink-0`}
      onError={() => setFailed(true)}
    />
  );
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function timeUntil(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return "Starting now";
  const totalMins = Math.floor(diff / 60_000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `in ${mins}m`;
  if (mins === 0) return `in ${hours}h`;
  return `in ${hours}h ${mins}m`;
}

export function MatchCard({
  match,
  isLive,
  league,
}: {
  match: ESPNMatch;
  isLive: boolean;
  league: TeamLeagueConfig;
}) {
  const { sources, date: kickoffMs } = match;

  const [isHovered, setIsHovered] = useState(false);
  const [bestSource, setBestSource] = useState<MatchSource | null>(null);

  useEffect(() => {
    if (sources.length === 0) return;
    let cancelled = false;
    const query = sources.map((s) => `${s.source}:${s.id}`).join(",");
    fetch(`/api/viewers?sources=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then(({ best, all }: { best: { source: string; id: string } | null; all: { source: string; viewers: number }[] }) => {
        if (cancelled) return;
        if (best) {
          const matched = sources.find((s) => s.source === best.source && s.id === best.id);
          if (matched) setBestSource(matched);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [match.id]);

  function handleCardClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("a")) return;
    const isMobile = window.innerWidth < 768;
    // Mobile can only play a subset of sources, so it has its own (shorter) order
    // and deliberately no highest-viewer / first-source fallback.
    const order = isMobile ? league.mobilePriority : league.desktopPriority;
    let target: MatchSource | null | undefined;
    for (const name of order) {
      target = pick(sources, name, !isMobile);
      if (target) break;
    }
    if (!target && !isMobile) target = bestSource ?? sources[0];
    if (!target) return;
    window.open(target.url ?? embedUrl(target.source, target.id), "_blank", "noopener,noreferrer");
  }

  const liveIndicator = isLive ? (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" style={{ boxShadow: "0 0 6px rgba(239,68,68,0.8)" }} />
      </span>
      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#ef4444", textShadow: "0 0 12px rgba(239,68,68,0.5)" }}>
        Live{match.clock ? <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600 }}> · {match.clock}</span> : null}
      </span>
    </div>
  ) : match.isPostponed ? (
    <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
      Postponed
    </span>
  ) : (
    <span className="text-[11px] font-semibold" style={{ color: "rgba(52,211,153,0.8)" }}>{timeUntil(kickoffMs)}</span>
  );

  const scoreOrVs = match.score !== undefined ? (
    <div
      className="flex items-center justify-center px-3 py-1 rounded-lg"
      style={{
        background: "rgba(0,0,0,0.45)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
      }}
    >
      <span
        className="text-xl font-black tabular-nums whitespace-nowrap"
        style={{
          fontFamily: "var(--font-sport)",
          color: "#ffffff",
          textShadow: isLive ? "0 0 20px rgba(255,255,255,0.4)" : "none",
          letterSpacing: "0.05em",
        }}
      >
        {match.score.home} <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>-</span> {match.score.away}
      </span>
    </div>
  ) : (
    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>vs</span>
  );

  // Only show stream badges from 30 min before kickoff through 30 min after finish
  const showStreams = sources.length > 0 &&
    (isLive || match.isFinished || Date.now() >= kickoffMs - 30 * 60_000);

  const allBadges = sources;

  function StreamBadge({ s }: { s: MatchSource }) {
    return (
      <a
        href={s.url ?? embedUrl(s.source, s.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-150"
        style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "rgba(52,211,153,0.9)" }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(52,211,153,0.18)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(52,211,153,0.5)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(52,211,153,0.08)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(52,211,153,0.2)";
        }}
      >
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        {s.source}
      </a>
    );
  }


  return (
    <div
      className="relative w-full transition-all duration-200 rounded-2xl cursor-pointer active:scale-[0.99]"
      style={{
        background: (isHovered)
          ? "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.06) 100%)"
          : "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
        border: isLive
          ? ((isHovered) ? "1px solid rgba(239,68,68,0.45)" : "1px solid rgba(239,68,68,0.25)")
          : ((isHovered) ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.08)"),
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: isLive
          ? "0 4px 32px rgba(239,68,68,0.12), 0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)"
          : ((isHovered)
            ? "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.10)"
            : "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"),
      }}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >

      {/* ── MOBILE layout (hidden at md+) ── */}
      <div className="md:hidden flex flex-col gap-2.5 px-4 py-3">
        <div className="flex items-center justify-between">
          {liveIndicator}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>{formatDate(kickoffMs)}</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>{formatTime(kickoffMs)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
              <span className="text-sm font-bold truncate text-right uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}>{displayName(match.homeTeam.name)}</span>
              <TeamBadge logo={match.homeTeam.logo} name={displayName(match.homeTeam.name)} className="w-7 h-7" fallback={league.teamFallback} />
            </div>
            <div className="shrink-0 w-14 flex items-center justify-center">{scoreOrVs}</div>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <TeamBadge logo={match.awayTeam.logo} name={displayName(match.awayTeam.name)} className="w-7 h-7" fallback={league.teamFallback} />
              <span className="text-sm font-bold truncate uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}>{displayName(match.awayTeam.name)}</span>
            </div>
          </div>
          {hasDetail(league, match) && (
            <div className="flex gap-2 text-[10px]">
              <div className="flex-1 flex flex-col items-end gap-px">
                <TeamDetail league={league} side="home" goals={match.goals} primary="rgba(255,255,255,0.45)" secondary="rgba(255,255,255,0.25)" />
              </div>
              <div className="shrink-0 w-14" />
              <div className="flex-1 flex flex-col items-start gap-px">
                <TeamDetail league={league} side="away" goals={match.goals} primary="rgba(255,255,255,0.45)" secondary="rgba(255,255,255,0.25)" />
              </div>
            </div>
          )}
        </div>

        {match.venue && (
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.40)" }}>
            <span className="font-semibold" style={{ color: "rgba(255,255,255,0.60)" }}>
              {match.venue.city}{match.venue.country ? `, ${match.venue.country}` : ""}
            </span>
            {match.venue.stadium && <span> · {match.venue.stadium}</span>}
          </p>
        )}

        {showStreams && (
          <div className="flex flex-wrap gap-1.5 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {allBadges.map((s) => <StreamBadge key={`${s.source}:${s.id}`} s={s} />)}
          </div>
        )}
      </div>

      {/* ── DESKTOP layout (hidden below md) ── */}
      <div className="hidden md:flex flex-col px-5 pt-4 pb-3 gap-2">
        {/* Main row: relative wrapper so badges align with the team row */}
        <div className="relative">
          <div
            className="grid items-center gap-6"
            style={{ gridTemplateColumns: "1fr 2fr 1fr" }}
          >
            <div className="flex flex-col gap-0.5">
              <div className="mb-0.5">{liveIndicator}</div>
              <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>{formatDate(kickoffMs)}</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{formatTime(kickoffMs)}</span>
              {match.venue && (
                <div className="mt-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-xs font-bold leading-tight" style={{ color: "rgba(255,255,255,0.80)" }}>{match.venue.city}{match.venue.country ? `, ${match.venue.country}` : ""}</p>
                  <p className="text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>{match.venue.stadium}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
                <span className="text-sm font-bold truncate text-right uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}>{displayName(match.homeTeam.name)}</span>
                <TeamBadge logo={match.homeTeam.logo} name={displayName(match.homeTeam.name)} className="w-10 h-10" fallback={league.teamFallback} />
              </div>
              <div className="shrink-0 flex items-center justify-center">{scoreOrVs}</div>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <TeamBadge logo={match.awayTeam.logo} name={displayName(match.awayTeam.name)} className="w-10 h-10" fallback={league.teamFallback} />
                <span className="text-sm font-bold truncate uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}>{displayName(match.awayTeam.name)}</span>
              </div>
            </div>
          </div>

          {showStreams && isHovered && (
            <div
              className="flex absolute right-0 inset-y-0 flex-wrap gap-1.5 justify-end items-center"
              style={{ width: "22%" }}
            >
              {allBadges.map((s) => <StreamBadge key={`${s.source}:${s.id}`} s={s} />)}
            </div>
          )}
        </div>

        {/* Detail row: card expands below, aligned under the center column */}
        {hasDetail(league, match) && (
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: "1fr 2fr 1fr" }}
          >
            <div />
            <div className="flex gap-3 text-[10px]">
              <div className="flex-1 flex flex-col items-end gap-px">
                <TeamDetail league={league} side="home" goals={match.goals} primary="rgba(255,255,255,0.45)" secondary="rgba(255,255,255,0.25)" />
              </div>
              <div className="shrink-0" style={{ visibility: "hidden" }}>{scoreOrVs}</div>
              <div className="flex-1 flex flex-col items-start gap-px">
                <TeamDetail league={league} side="away" goals={match.goals} primary="rgba(255,255,255,0.45)" secondary="rgba(255,255,255,0.25)" />
              </div>
            </div>
            <div />
          </div>
        )}

      </div>
    </div>
  );
}
