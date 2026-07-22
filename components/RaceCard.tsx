"use client";

import { useState } from "react";
import type { MatchSource, PodiumEntry, RaceEvent } from "@/types";
import type { RaceLeagueConfig } from "@/lib/leagues";
import { embedUrl } from "@/lib/api";
import { TeamFlag } from "@/components/TeamFlag";

/** "7 – 9 Aug" — a race weekend spans days, so both ends are shown. */
function formatRange(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const endStr = end.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  if (start.toDateString() === end.toDateString()) return endStr;
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString(
    "en-US",
    sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" }
  );
  return `${startStr} – ${endStr}`;
}

function formatYear(ms: number): string {
  return String(new Date(ms).getFullYear());
}

/** Race-session start as "Sun 9:00 AM" in the viewer's local time. */
function formatRaceStart(ms: number): string {
  const d = new Date(ms);
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} ${time}`;
}

function daysUntil(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return "Under way";
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `in ${days} days`;
  return `in ${Math.floor(days / 7)} weeks`;
}

const POSITION_COLORS = ["#fbbf24", "#cbd5e1", "#d97706"];

/** "Fabio Di Giannantonio" → "F. Di Giannantonio" — full names don't fit a column. */
function shortRider(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

function SessionResults({
  label,
  entries,
  muted,
}: {
  label: string;
  entries: PodiumEntry[];
  muted: boolean;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="min-w-0">
      <p
        className="text-[9px] font-black uppercase tracking-widest mb-1 pb-1"
        style={{ color: "rgba(255,255,255,0.28)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {label}
      </p>
      <div className="flex flex-col gap-0.5">
        {entries.map((p, i) => (
          <div key={p.position} className="flex items-baseline gap-1.5 text-[11px]">
            <span
              className="font-black tabular-nums w-2 shrink-0"
              style={{ color: POSITION_COLORS[i] ?? "rgba(255,255,255,0.4)", opacity: muted ? 0.75 : 1 }}
            >
              {p.position}
            </span>
            <span
              className="font-bold truncate uppercase tracking-wide"
              style={{ color: muted ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}
              title={`${p.rider} · ${p.team}`}
            >
              {shortRider(p.rider)}
            </span>
            <span className="ml-auto tabular-nums shrink-0 pl-1" style={{ color: "rgba(255,255,255,0.40)" }}>
              {p.points !== undefined ? `${p.points}` : p.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** All three sessions side by side. */
function ResultsGrid({ results, muted }: { results: RaceEvent["results"]; muted: boolean }) {
  return (
    <div className="grid gap-x-5 gap-y-3 grid-cols-1 sm:grid-cols-3">
      <SessionResults label="Qualifying" entries={results.qualifying} muted={muted} />
      <SessionResults label="Sprint" entries={results.sprint} muted={muted} />
      <SessionResults label="Race" entries={results.race} muted={muted} />
    </div>
  );
}

export function RaceCard({
  event,
  league,
  isPast,
  isLive,
}: {
  event: RaceEvent;
  league: RaceLeagueConfig;
  isPast: boolean;
  /** Computed on the server — the weekend is under way */
  isLive: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { sources } = event;

  const { qualifying, sprint, race } = event.results;
  const hasResults = qualifying.length + sprint.length + race.length > 0;
  const hasExtraSessions = qualifying.length > 0 || sprint.length > 0;

  function handleCardClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("a")) return;
    const isMobile = window.innerWidth < 768;
    const order = isMobile ? league.mobilePriority : league.desktopPriority;
    let target: MatchSource | undefined;
    for (const name of order) {
      target = sources.find((s) => s.source === name);
      if (target) break;
    }
    if (!target && !isMobile) target = sources[0];
    if (!target) return;
    window.open(target.url ?? embedUrl(target.source, target.id), "_blank", "noopener,noreferrer");
  }

  // Streams only make sense for a weekend that hasn't finished
  const showStreams = sources.length > 0 && !event.isFinished;

  const statusEl = isLive && !event.isFinished ? (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" style={{ boxShadow: "0 0 6px rgba(239,68,68,0.8)" }} />
      </span>
      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#ef4444", textShadow: "0 0 12px rgba(239,68,68,0.5)" }}>
        Race weekend
      </span>
    </div>
  ) : event.isFinished ? (
    <span
      className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.40)" }}
    >
      Final
    </span>
  ) : (
    <span className="text-[11px] font-semibold" style={{ color: "rgba(52,211,153,0.8)" }}>
      {daysUntil(event.dateStart)}
    </span>
  );

  const roundBadge = (
    <span
      className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest shrink-0 tabular-nums"
      style={{
        background: `rgba(${league.accent},0.08)`,
        border: `1px solid rgba(${league.accent},0.25)`,
        color: `rgba(${league.accent},0.75)`,
      }}
    >
      R{event.round}
    </span>
  );

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

  const clickable = showStreams;

  return (
    <div
      className={`relative w-full transition-all duration-200 rounded-2xl ${clickable ? "cursor-pointer active:scale-[0.99]" : ""}`}
      style={{
        background: isPast
          ? "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)"
          : isHovered
            ? "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.06) 100%)"
            : "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
        border: isLive && !event.isFinished
          ? (isHovered ? "1px solid rgba(239,68,68,0.45)" : "1px solid rgba(239,68,68,0.25)")
          : (isHovered && !isPast ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.08)"),
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        opacity: isPast ? 0.65 : 1,
        boxShadow: isLive && !event.isFinished
          ? "0 4px 32px rgba(239,68,68,0.12), 0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)"
          : "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
      onClick={clickable ? handleCardClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── MOBILE layout ── */}
      <div className="md:hidden flex flex-col gap-2.5 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          {statusEl}
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>{formatRange(event.dateStart, event.dateEnd)}</span>
              {roundBadge}
            </div>
            {event.raceStart !== undefined && (
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.40)" }}>
                Race · {formatRaceStart(event.raceStart)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <TeamFlag name={event.countryIso} className="w-9 h-6" />
          <div className="min-w-0">
            <p className="text-sm font-bold truncate uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}>{event.name}</p>
            <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.40)" }}>
              {event.circuit}{event.place ? ` · ${event.place}` : ""}
            </p>
          </div>
        </div>

        {hasResults && (
          <div className="pt-2 flex flex-col gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {/* Race result always; qualifying and sprint behind a toggle so the
                calendar stays scannable on a phone. */}
            <SessionResults label="Race" entries={event.results.race} muted={isPast} />
            {expanded && (
              <>
                <SessionResults label="Qualifying" entries={event.results.qualifying} muted={isPast} />
                <SessionResults label="Sprint" entries={event.results.sprint} muted={isPast} />
              </>
            )}
            {hasExtraSessions && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                aria-expanded={expanded}
                className="self-start text-[10px] font-black uppercase tracking-widest py-1"
                style={{ color: `rgba(${league.accent},0.75)` }}
              >
                {expanded ? "Hide sessions" : "Qualifying & sprint"}
              </button>
            )}
          </div>
        )}

        {showStreams && (
          <div className="flex flex-wrap gap-1.5 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {sources.map((s) => <StreamBadge key={`${s.source}:${s.id}`} s={s} />)}
          </div>
        )}
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden md:flex flex-col px-5 py-4 gap-3">
        <div
          className="grid items-center gap-6"
          style={{ gridTemplateColumns: "1fr 2fr 1fr" }}
        >
          <div className="flex flex-col gap-0.5">
            <div className="mb-0.5">{statusEl}</div>
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>{formatRange(event.dateStart, event.dateEnd)}</span>
            {event.raceStart !== undefined && (
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                Race · {formatRaceStart(event.raceStart)}
              </span>
            )}
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>{formatYear(event.dateStart)}</span>
          </div>

          <div className="flex items-center gap-3 min-w-0">
            <TeamFlag name={event.countryIso} className="w-10 h-7" />
            <div className="min-w-0">
              <p className="text-sm font-bold truncate uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}>{event.name}</p>
              <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.40)" }}>
                {event.circuit}{event.place ? ` · ${event.place}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            {showStreams && isHovered
              ? sources.map((s) => <StreamBadge key={`${s.source}:${s.id}`} s={s} />)
              : roundBadge}
          </div>
        </div>

        {/* Results span the full card width so three columns have room to breathe */}
        {hasResults && (
          <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <ResultsGrid results={event.results} muted={isPast} />
          </div>
        )}
      </div>
    </div>
  );
}
