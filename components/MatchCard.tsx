"use client";

import { useRef, useState } from "react";
import type { Match, MatchEnrichment } from "@/types";
import { badgeUrl, embedUrl, usableSources } from "@/lib/api";

function TeamBadge({ badge, name, className = "w-10 h-10" }: { badge?: string; name?: string; className?: string }) {
  if (!badge) {
    return (
      <div className={`${className} rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-400 shrink-0`}>
        {name?.charAt(0) ?? "?"}
      </div>
    );
  }
  return (
    <img
      src={badgeUrl(badge)}
      alt={name ?? "Team"}
      className={`${className} object-contain shrink-0`}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
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
  enrichment,
}: {
  match: Match;
  isLive?: boolean;
  enrichment?: MatchEnrichment;
}) {
  const sources = usableSources(match.sources);
  const score = enrichment?.score;
  const venue = enrichment?.venue;

  const [showStreams, setShowStreams] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PRIORITY = ["delta", "echo", "golf"];
  const preferredSource =
    PRIORITY.map((p) => sources.find((s) => s.source.toLowerCase() === p)).find(Boolean) ??
    sources[0];

  function handleMouseEnter() {
    setIsHovered(true);
    timerRef.current = setTimeout(() => setShowStreams(true), 500);
  }

  function handleMouseLeave() {
    setIsHovered(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowStreams(false);
  }

  function handleCardClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("a")) return;
    if (preferredSource) {
      window.open(embedUrl(preferredSource.source, preferredSource.id), "_blank", "noopener,noreferrer");
    }
  }

  // Shared sub-elements
  const liveIndicator = isLive ? (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" style={{ boxShadow: "0 0 6px rgba(239,68,68,0.8)" }} />
      </span>
      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#ef4444", textShadow: "0 0 12px rgba(239,68,68,0.5)" }}>Live</span>
    </div>
  ) : (
    <span className="text-[11px] font-semibold" style={{ color: "rgba(52,211,153,0.8)" }}>{timeUntil(match.date)}</span>
  );

  const scoreOrVs = score !== undefined ? (
    <div
      className="flex items-center justify-center px-3 py-1 rounded-lg"
      style={{
        background: "rgba(0,0,0,0.45)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
      }}
    >
      <span
        className="text-xl font-black tabular-nums"
        style={{
          fontFamily: "var(--font-sport)",
          color: "#ffffff",
          textShadow: isLive ? "0 0 20px rgba(255,255,255,0.4)" : "none",
          letterSpacing: "0.05em",
        }}
      >
        {score.home} <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>-</span> {score.away}
      </span>
    </div>
  ) : (
    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>vs</span>
  );

  const streamBadges = sources.map((s) => (
    <a
      key={`${s.source}-${s.id}`}
      href={embedUrl(s.source, s.id)}
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
  ));

  return (
    <div
      className="w-full cursor-pointer transition-all duration-200 rounded-2xl active:scale-[0.99] active:brightness-90"
      style={{
        background: isHovered
          ? "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.06) 100%)"
          : "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
        border: isLive
          ? (isHovered ? "1px solid rgba(239,68,68,0.45)" : "1px solid rgba(239,68,68,0.25)")
          : (isHovered ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.08)"),
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: isLive
          ? "0 4px 32px rgba(239,68,68,0.12), 0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)"
          : (isHovered
            ? "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.10)"
            : "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"),
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >

      {/* ── MOBILE layout (hidden at md+) ── */}
      <div className="md:hidden flex flex-col gap-2.5 px-4 py-3">
        {/* Row 1: status left, date/time right */}
        <div className="flex items-center justify-between">
          {liveIndicator}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>{formatDate(match.date)}</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>{formatTime(match.date)}</span>
          </div>
        </div>

        {/* Row 2: home | score | away */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <span className="text-sm font-bold truncate text-right uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}>{match.teams?.home?.name ?? "Home"}</span>
            <TeamBadge badge={match.teams?.home?.badge} name={match.teams?.home?.name} className="w-7 h-7" />
          </div>
          <div className="shrink-0 w-14 flex items-center justify-center">{scoreOrVs}</div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <TeamBadge badge={match.teams?.away?.badge} name={match.teams?.away?.name} className="w-7 h-7" />
            <span className="text-sm font-bold truncate uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}>{match.teams?.away?.name ?? "Away"}</span>
          </div>
        </div>

        {/* Row 3: venue (compact inline) */}
        {venue && (
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.40)" }}>
            <span className="font-semibold" style={{ color: "rgba(255,255,255,0.60)" }}>
              {venue.city}{venue.country ? `, ${venue.country}` : ""}
            </span>
            {venue.stadium && <span> · {venue.stadium}</span>}
          </p>
        )}

        {/* Row 4: stream picker — only shown when there are multiple streams */}
        {sources.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {streamBadges}
          </div>
        )}
      </div>

      {/* ── DESKTOP layout (hidden below md) ── */}
      <div
        className="hidden md:grid items-center gap-6 px-5 py-4"
        style={{ gridTemplateColumns: "1fr 2fr 1fr" }}
      >
        {/* Left: time + venue */}
        <div className="flex flex-col gap-0.5">
          <div className="mb-0.5">{liveIndicator}</div>
          <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>{formatDate(match.date)}</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{formatTime(match.date)}</span>
          {venue && (
            <div className="mt-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs font-bold leading-tight" style={{ color: "rgba(255,255,255,0.80)" }}>{venue.city}{venue.country ? `, ${venue.country}` : ""}</p>
              <p className="text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>{venue.stadium}</p>
            </div>
          )}
        </div>

        {/* Center: teams + score */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
            <span className="text-sm font-bold truncate text-right uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}>{match.teams?.home?.name ?? "Home"}</span>
            <TeamBadge badge={match.teams?.home?.badge} name={match.teams?.home?.name} />
          </div>
          <div className="shrink-0 w-16 flex items-center justify-center">{scoreOrVs}</div>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <TeamBadge badge={match.teams?.away?.badge} name={match.teams?.away?.name} />
            <span className="text-sm font-bold truncate uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}>{match.teams?.away?.name ?? "Away"}</span>
          </div>
        </div>

        {/* Right: stream badges (hover-reveal) */}
        <div className={`flex flex-wrap gap-1.5 justify-end transition-opacity duration-200 ${showStreams ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          {streamBadges}
        </div>
      </div>
    </div>
  );
}
