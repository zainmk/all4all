import { getLiveMatches, getTodayMatches, filterFootball } from "@/lib/api";
import { getEnrichments, getPastMatches } from "@/lib/sofascore";
import { MatchCard } from "@/components/MatchCard";
import { PastMatchCard } from "@/components/PastMatchCard";
import { RefreshLive } from "@/components/RefreshLive";
import { ScrollToNow } from "@/components/ScrollToNow";

export const revalidate = 30;

export default async function HomePage() {
  const [liveAll, todayAll, past] = await Promise.all([
    getLiveMatches(),
    getTodayMatches(),
    getPastMatches(3),
  ]);

  const live = filterFootball(liveAll);
  const today = filterFootball(todayAll);
  const liveIds = new Set(live.map((m) => m.id));
  const upcoming = today
    .filter((m) => !liveIds.has(m.id))
    .sort((a, b) => a.date - b.date);

  const allMatches = [...live, ...upcoming];
  const enrichments = await getEnrichments(allMatches);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #0d1a3a 0%, #090d1f 30%, #050508 60%, #080d0a 100%)" }}>
      <RefreshLive />

      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        {/* Top-center amber glow — trophy / header warmth */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-35" style={{ background: "radial-gradient(ellipse, #92400e 0%, transparent 65%)" }} />
        {/* Upper-left cobalt — FIFA blue */}
        <div className="absolute -top-10 -left-32 w-[700px] h-[700px] rounded-full opacity-25" style={{ background: "radial-gradient(ellipse, #1e3a8a 0%, transparent 65%)" }} />
        {/* Lower-right emerald — pitch green */}
        <div className="absolute bottom-0 -right-40 w-[700px] h-[700px] rounded-full opacity-20" style={{ background: "radial-gradient(ellipse, #064e3b 0%, transparent 65%)" }} />
        {/* Centre deep blue sweep */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] rounded-full opacity-10" style={{ background: "radial-gradient(ellipse, #1d4ed8 0%, transparent 70%)" }} />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/5 backdrop-blur-xl" style={{ background: "rgba(5,5,8,0.75)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center gap-3">
          <svg className="w-6 h-6 text-amber-400 shrink-0 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V17H7v2h10v-2h-4v-2.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
          </svg>
          <h1 className="text-base font-black tracking-widest text-white uppercase drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
            Welcome to <span className="text-amber-400">FIFA 26</span>
          </h1>
          <svg className="w-6 h-6 text-amber-400 shrink-0 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V17H7v2h10v-2h-4v-2.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
          </svg>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-3">
        {past.length === 0 && allMatches.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-20">No matches found.</p>
        )}

        {past.map((m) => (
          <PastMatchCard key={m.id} match={m} />
        ))}

        {/* "Now" divider — sits between past and present/future */}
        {past.length > 0 && allMatches.length > 0 && (
          <>
            <ScrollToNow />
            <div id="now" className="flex items-center gap-4 py-3" style={{ scrollMarginTop: "72px" }}>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(251,191,36,0.55))" }} />
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" style={{ boxShadow: "0 0 6px rgba(251,191,36,0.9)" }} />
                </span>
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(251,191,36,0.85)", textShadow: "0 0 12px rgba(251,191,36,0.4)" }}>Now</span>
              </div>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, rgba(251,191,36,0.55))" }} />
            </div>
          </>
        )}

        {allMatches.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            isLive={liveIds.has(m.id)}
            enrichment={enrichments.get(m.id)}
          />
        ))}
      </main>

      {/* Bottom vignette fade */}
      <div className="pointer-events-none fixed bottom-0 inset-x-0 h-28 -z-10" style={{ background: "linear-gradient(to top, rgba(7,9,20,0.8) 0%, transparent 100%)" }} />

      <footer className="mt-16 pb-10 pt-6 text-center border-t border-white/5">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Streams by streamed.pk · Scores by ESPN</p>
      </footer>
    </div>
  );
}
