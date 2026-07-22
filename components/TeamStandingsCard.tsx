"use client";

import { useState } from "react";
import type { ConferenceStandings, TeamStanding, TeamStandingsData } from "@/types";
import type { TeamLeagueConfig } from "@/lib/leagues";

function Trophy({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" aria-hidden="true">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" fill={color} />
      <path d="M7 5H5a2 2 0 0 0 0 4h2M17 5h2a2 2 0 0 1 0 4h-2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 14v3m-3 3h6m-6 0a3 3 0 0 1 3-3 3 3 0 0 1 3 3" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TeamLogo({ logo, abbrev }: { logo?: string; abbrev: string }) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) {
    return (
      <span
        className="w-5 h-5 rounded shrink-0 flex items-center justify-center text-[8px] font-black"
        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
      >
        {abbrev.slice(0, 3)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logo} alt="" className="w-5 h-5 object-contain shrink-0" onError={() => setFailed(true)} />;
}

/** "W3" green, "L2" red. */
function Streak({ streak }: { streak: string }) {
  const win = streak.startsWith("W");
  if (!streak) return <span style={{ color: "rgba(255,255,255,0.25)" }}>–</span>;
  return (
    <span
      className="tabular-nums font-bold"
      style={{ color: win ? "rgba(52,211,153,0.85)" : "rgba(239,68,68,0.75)" }}
      title={win ? `Won last ${streak.slice(1)}` : `Lost last ${streak.slice(1)}`}
    >
      {streak}
    </span>
  );
}

function ConferenceTable({ conf, accent }: { conf: ConferenceStandings; accent: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-1.5 pb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: `rgba(${accent},0.75)` }}>
          {conf.name}
        </span>
        <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.30)" }}>
          <span className="w-12 text-right">W–L</span>
          <span className="hidden sm:inline w-8 text-right">PCT</span>
          <span className="hidden sm:inline w-8 text-right">GB</span>
          <span className="w-8 text-right">STRK</span>
          <span className="hidden lg:inline w-10 text-right">L10</span>
        </div>
      </div>

      <div className="flex flex-col">
        {conf.teams.map((t: TeamStanding, i) => (
          <div
            key={t.abbrev || t.team}
            className="flex items-center gap-2 py-1.5 text-[11px]"
            style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)" }}
          >
            <span className="w-4 shrink-0 text-right tabular-nums font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>
              {i + 1}
            </span>
            <TeamLogo logo={t.logo} abbrev={t.abbrev} />
            <span
              className="font-bold uppercase tracking-wide truncate min-w-0 flex-1"
              style={{ color: "rgba(255,255,255,0.90)", fontFamily: "var(--font-sport)" }}
            >
              {/* Abbreviation on phones, full name once there's room */}
              <span className="md:hidden">{t.abbrev}</span>
              <span className="hidden md:inline">{t.team}</span>
            </span>
            <span className="w-12 text-right tabular-nums font-bold shrink-0" style={{ color: "rgba(255,255,255,0.85)" }}>
              {t.wins}–{t.losses}
            </span>
            <span className="hidden sm:inline w-8 text-right tabular-nums shrink-0" style={{ color: "rgba(255,255,255,0.45)" }}>
              {t.winPct}
            </span>
            <span className="hidden sm:inline w-8 text-right tabular-nums shrink-0" style={{ color: "rgba(255,255,255,0.45)" }}>
              {t.gamesBehind}
            </span>
            <span className="w-8 text-right shrink-0 text-[10px]">
              <Streak streak={t.streak} />
            </span>
            <span className="hidden lg:inline w-10 text-right tabular-nums shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>
              {t.lastTen}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamStandingsCard({
  data,
  league,
}: {
  data: TeamStandingsData;
  league: TeamLeagueConfig;
}) {
  const { accent } = league;
  if (data.conferences.length === 0) return null;

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
        <h2
          className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2"
          style={{ color: `rgba(${accent},0.85)` }}
        >
          <Trophy color={`rgba(${accent},0.9)`} />
          {data.title}
        </h2>

        <div className="grid gap-x-8 gap-y-5 grid-cols-1 md:grid-cols-2">
          {data.conferences.map((conf) => (
            <ConferenceTable key={conf.name} conf={conf} accent={accent} />
          ))}
        </div>
      </div>
    </div>
  );
}
