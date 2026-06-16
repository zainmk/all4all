import type { PastMatch } from "@/types";

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

const ftBadge = (
  <span
    className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest shrink-0"
    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.40)" }}
  >
    FT
  </span>
);

export function PastMatchCard({ match }: { match: PastMatch }) {
  const { homeTeam, awayTeam, score, venue, date } = match;

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
        {/* Row 1: date/time + FT */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.60)" }}>{formatDate(date)}</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{formatTime(date)}</span>
          </div>
          {ftBadge}
        </div>

        {/* Row 2: home | score | away */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold truncate flex-1 text-right uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.70)", fontFamily: "var(--font-sport)" }}>{homeTeam}</span>
          {scoreEl}
          <span className="text-sm font-bold truncate flex-1 uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.70)", fontFamily: "var(--font-sport)" }}>{awayTeam}</span>
        </div>

        {/* Row 3: venue (compact) */}
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
        {/* Left: date + venue */}
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

        {/* Center: teams + score */}
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm font-bold truncate text-right flex-1 uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.70)", fontFamily: "var(--font-sport)" }}>{homeTeam}</span>
          {scoreEl}
          <span className="text-sm font-bold truncate flex-1 uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.70)", fontFamily: "var(--font-sport)" }}>{awayTeam}</span>
        </div>

        {/* Right: FT badge */}
        <div className="flex justify-end">{ftBadge}</div>
      </div>
    </div>
  );
}
