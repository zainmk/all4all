"use client";

import { useState } from "react";
import { resolveAlias } from "@/lib/team-aliases";
import type { BracketData, BracketMatch, BracketTeam } from "@/lib/bracket";
import { ROUND_ORDER } from "@/lib/bracket";

function normalizeKey(name: string): string {
  return resolveAlias(
    name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "")
  );
}

function bracketTeamKey(home: string, away: string): string {
  return `${normalizeKey(home)}_${normalizeKey(away)}`;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const SLOT = 44;    // px height of one R32 slot (base unit)
const CARD_H = 34;  // px height of one match card (two rows + divider)
const COL_W = 164;  // px width of a round column
const CONN_W = 30;  // px width of a connector column between rounds

// Position of match card top-edge within an infinite bracket grid
function getMatchTop(globalRoundIdx: number, matchIdx: number): number {
  const slotsPerMatch = Math.pow(2, globalRoundIdx);
  const centerSlot = matchIdx * slotsPerMatch + slotsPerMatch / 2;
  return centerSlot * SLOT - CARD_H / 2;
}

function getMatchCenter(globalRoundIdx: number, matchIdx: number): number {
  return getMatchTop(globalRoundIdx, matchIdx) + CARD_H / 2;
}

// Container height needed to show all cards in the leftmost visible round
function neededHeight(globalRoundIdx: number, matchCount: number): number {
  if (matchCount === 0) return 200;
  return getMatchTop(globalRoundIdx, matchCount - 1) + CARD_H + 24;
}

function isTBD(name: string): boolean {
  return !name || name.toLowerCase().includes("winner") || name.toLowerCase().includes("loser");
}

// ── Team row inside a match card ─────────────────────────────────────────────
function TeamRow({ team, showScore }: { team: BracketTeam; showScore: boolean }) {
  const tbd = isTBD(team.name);
  const rowH = (CARD_H - 2) / 2;

  return (
    <div
      style={{
        height: rowH,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "0 6px",
      }}
    >
      {!tbd && team.logo ? (
        <img
          src={team.logo}
          alt={team.abbr}
          style={{ width: 13, height: 13, objectFit: "contain", flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 13,
            height: 13,
            borderRadius: 2,
            background: tbd ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.15)",
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          flex: 1,
          fontSize: 9,
          fontWeight: tbd ? 500 : 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          color: tbd
            ? "rgba(255,255,255,0.18)"
            : team.winner
            ? "#ffffff"
            : "rgba(255,255,255,0.70)",
        }}
      >
        {tbd ? "TBD" : team.abbr || team.name}
      </span>
      {showScore && team.score !== undefined && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            fontVariantNumeric: "tabular-nums",
            color: team.winner ? "#ffffff" : "rgba(255,255,255,0.45)",
            flexShrink: 0,
          }}
        >
          {team.score}
        </span>
      )}
    </div>
  );
}

// ── Match card ────────────────────────────────────────────────────────────────
function MatchCard({ match, onClick }: { match: BracketMatch; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const showScore = match.status !== "scheduled";
  const isLive = match.status === "live";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => { if (onClick) setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: COL_W,
        height: CARD_H,
        background: hovered ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
        border: isLive
          ? "1px solid rgba(239,68,68,0.4)"
          : hovered
          ? "1px solid rgba(255,255,255,0.22)"
          : "1px solid rgba(255,255,255,0.09)",
        borderRadius: 5,
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "background 0.1s, border-color 0.1s",
        boxShadow: isLive
          ? "0 0 10px rgba(239,68,68,0.15)"
          : "0 1px 4px rgba(0,0,0,0.4)",
      }}
    >
      <TeamRow team={match.home} showScore={showScore} />
      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
      <TeamRow team={match.away} showScore={showScore} />
    </div>
  );
}

// ── Connector lines between rounds ───────────────────────────────────────────
function ConnectorColumn({
  fromRoundIdx,
  toMatchCount,
  totalH,
}: {
  fromRoundIdx: number;
  toMatchCount: number;
  totalH: number;
}) {
  const lineColor = "rgba(255,255,255,0.11)";

  return (
    <div style={{ width: CONN_W, height: totalH, position: "relative", flexShrink: 0 }}>
      {Array.from({ length: toMatchCount }, (_, i) => {
        const topCenter = getMatchCenter(fromRoundIdx, 2 * i);
        const botCenter = getMatchCenter(fromRoundIdx, 2 * i + 1);
        const midY = (topCenter + botCenter) / 2;

        return (
          <div key={i}>
            <div style={{ position: "absolute", left: CONN_W / 2, top: topCenter, width: 1, height: botCenter - topCenter, background: lineColor }} />
            <div style={{ position: "absolute", left: 0, top: topCenter, width: CONN_W / 2, height: 1, background: lineColor }} />
            <div style={{ position: "absolute", left: 0, top: botCenter, width: CONN_W / 2, height: 1, background: lineColor }} />
            <div style={{ position: "absolute", left: CONN_W / 2, top: midY, width: CONN_W / 2, height: 1, background: lineColor }} />
          </div>
        );
      })}
    </div>
  );
}

// ── 3rd place card ────────────────────────────────────────────────────────────
function ThirdPlaceCard({ match }: { match: BracketMatch }) {
  const showScore = match.status !== "scheduled";
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "rgba(251,191,36,0.45)",
          textAlign: "center",
          marginBottom: 6,
        }}
      >
        3rd Place
      </div>
      <div
        style={{
          width: COL_W,
          height: CARD_H,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 5,
          overflow: "hidden",
        }}
      >
        <TeamRow team={match.home} showScore={showScore} />
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
        <TeamRow team={match.away} showScore={showScore} />
      </div>
    </div>
  );
}

// ── Main bracket panel ────────────────────────────────────────────────────────
export function BracketPanel({
  data,
  matchKeyToId,
  onMatchClick,
}: {
  data: BracketData;
  matchKeyToId: Record<string, string>;
  onMatchClick: (matchId: string) => void;
}) {
  const panelStyle: React.CSSProperties = {
    background: "rgba(6,8,18,0.97)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
  };

  if (!data || data.rounds.length === 0) {
    return (
      <div style={{ ...panelStyle, padding: "20px 24px" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.1em" }}>
          Bracket not yet available — group stage in progress.
        </span>
      </div>
    );
  }

  const { rounds, thirdPlace } = data;

  // Current round = first round with at least one non-finished match.
  // Falls back to the last round if all are complete.
  const currentIdx = (() => {
    const i = rounds.findIndex((r) => r.matches.some((m) => m.status !== "finished"));
    return i === -1 ? rounds.length - 1 : i;
  })();

  // Show current round + next round (shows where winners advance to)
  const shownRounds = rounds.slice(currentIdx, Math.min(rounds.length, currentIdx + 2));

  // Container height is driven by the leftmost shown column
  const leftRound = shownRounds[0];
  const leftGlobalIdx = ROUND_ORDER.indexOf(leftRound.slug);
  const totalH = neededHeight(leftGlobalIdx, leftRound.matches.length);

  const showThirdPlace = shownRounds.some((r) => r.slug === "semifinals") && !!thirdPlace;

  return (
    <div style={panelStyle}>
      <div
        style={{
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "72vh",
          padding: "16px 24px 20px",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "flex-start" }}>
          {shownRounds.map((round, renderIdx) => {
            const globalIdx = ROUND_ORDER.indexOf(round.slug);
            const nextRound = shownRounds[renderIdx + 1];
            const showConnector = !!nextRound && nextRound.matches.length > 0;

            return (
              <div key={round.slug} style={{ display: "flex" }}>
                {/* Round column */}
                <div style={{ width: COL_W, position: "relative", height: totalH, flexShrink: 0 }}>
                  {/* Match cards */}
                  {round.matches.map((match, matchIdx) => {
                    const linkedId = matchKeyToId[bracketTeamKey(match.home.name, match.away.name)];
                    return (
                      <div
                        key={match.id}
                        style={{ position: "absolute", top: getMatchTop(globalIdx, matchIdx), left: 0 }}
                      >
                        <MatchCard
                          match={match}
                          onClick={linkedId ? () => onMatchClick(linkedId) : undefined}
                        />
                      </div>
                    );
                  })}

                  {/* 3rd place below SF column */}
                  {round.slug === "semifinals" && showThirdPlace && (
                    <div style={{ position: "absolute", top: totalH + 8, left: 0 }}>
                      <ThirdPlaceCard match={thirdPlace!} />
                    </div>
                  )}
                </div>

                {/* Connector to next round */}
                {showConnector && (
                  <ConnectorColumn
                    fromRoundIdx={globalIdx}
                    toMatchCount={nextRound.matches.length}
                    totalH={totalH}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom padding for 3rd place overflow */}
        {showThirdPlace && <div style={{ height: 80 }} />}
      </div>
    </div>
  );
}
