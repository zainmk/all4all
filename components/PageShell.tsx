import type { ReactNode } from "react";
import { LEAGUES, type LeagueId } from "@/lib/leagues";
import { RefreshLive } from "@/components/RefreshLive";
import { ScrollToNow } from "@/components/ScrollToNow";
import { AppHeader } from "@/components/AppHeader";
import { RememberLeague } from "@/components/RememberLeague";

/**
 * Shared chrome for every league page: gradient, ambient blobs, header,
 * the past/NOW/upcoming layout, and the footer. The page supplies the cards.
 */
export function PageShell({
  leagueId,
  past,
  upcoming,
  emptyMessage,
  nothingUpcomingMessage,
}: {
  leagueId: LeagueId;
  /** Already-rendered cards for events before now, oldest first */
  past: ReactNode[];
  /** Already-rendered cards for live + future events */
  upcoming: ReactNode[];
  /** Shown when there is nothing at all */
  emptyMessage: string;
  /** Shown under the NOW divider when only past events exist */
  nothingUpcomingMessage: string;
}) {
  const league = LEAGUES[leagueId];
  const accent = league.accent;

  return (
    <div className="min-h-screen" style={{ background: league.background }}>
      <RefreshLive />
      <RememberLeague leagueId={leagueId} />

      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        {league.blobs.map((b, i) => (
          <div
            key={i}
            className={`${b.className} rounded-full`}
            style={{
              opacity: b.opacity,
              background: `radial-gradient(ellipse, ${b.color} 0%, transparent ${b.stop})`,
            }}
          />
        ))}
      </div>

      <AppHeader active={leagueId} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-3">
        {past.length === 0 && upcoming.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-20">{emptyMessage}</p>
        )}

        {past}

        {/* NOW divider — always shown after past events */}
        {past.length > 0 && (
          <>
            <ScrollToNow />
            <div id="now" className="flex items-center gap-4 py-3" style={{ scrollMarginTop: "72px" }}>
              <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, rgba(${accent},0.55))` }} />
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: `rgb(${accent})` }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: `rgb(${accent})`, boxShadow: `0 0 6px rgba(${accent},0.9)` }} />
                </span>
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: `rgba(${accent},0.85)`, textShadow: `0 0 12px rgba(${accent},0.4)` }}>Now</span>
              </div>
              <div className="flex-1 h-px" style={{ background: `linear-gradient(to left, transparent, rgba(${accent},0.55))` }} />
            </div>
            {upcoming.length === 0 && (
              <p className="text-center text-sm py-6" style={{ color: "rgba(255,255,255,0.35)" }}>
                {nothingUpcomingMessage}
              </p>
            )}
          </>
        )}

        {upcoming}
      </main>

      {/* Bottom vignette fade */}
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-28 -z-10" style={{ background: "linear-gradient(to top, rgba(7,9,20,0.8) 0%, transparent 100%)" }} />

      <footer className="mt-16 pb-10 pt-6 text-center border-t border-white/5">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{league.footer}</p>
      </footer>
    </div>
  );
}
