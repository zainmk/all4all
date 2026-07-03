import { getLiveMatches, getTodayMatches, filterFootball } from "@/lib/api";
import { getESPNMatchRange, teamKey } from "@/lib/espn";
import { getCustomStreams } from "@/lib/custom-streams";
import { getFootybiteStreams } from "@/lib/footybite";
import { getSportekMatchUrls } from "@/lib/sportek";
import { MatchCard } from "@/components/MatchCard";
import { PastMatchCard } from "@/components/PastMatchCard";
import { RefreshLive } from "@/components/RefreshLive";
import { ScrollToNow } from "@/components/ScrollToNow";
import { AppHeader } from "@/components/AppHeader";
import { getBracketData } from "@/lib/bracket";
import type { ESPNMatch, MatchSource } from "@/types";

export const revalidate = 30;

export default async function HomePage() {
  const now = Date.now();

  // Phase 1: core data in parallel
  const [espnMatches, liveAll, todayAll, bracketData, sportekUrls] = await Promise.all([
    getESPNMatchRange(3, 3),
    getLiveMatches(),
    getTodayMatches(),
    getBracketData(),
    getSportekMatchUrls(),
  ]);

  const streamsDown = liveAll === null && todayAll === null;

  // Build team-key → sources lookup from streamed.pk (live + today)
  const streamMatches = filterFootball([...(liveAll ?? []), ...(todayAll ?? [])]);
  const streamLookup = new Map<string, MatchSource[]>();
  for (const m of streamMatches) {
    const home = m.teams?.home?.name;
    const away = m.teams?.away?.name;
    if (!home || !away) continue;
    const key = teamKey(home, away);
    const existing = streamLookup.get(key) ?? [];
    for (const s of m.sources) {
      if (s.source !== "admin" && s.source !== "echo") continue;
      if (!existing.some((e) => e.source === s.source && e.id === s.id)) existing.push(s);
    }
    streamLookup.set(key, existing);
  }

  // Phase 2: fetch footybite streams for active/upcoming matches in parallel
  // (past matches don't need streams; future matches return empty quickly and are cached)
  const activeEspn = espnMatches.filter(
    (m) => !m.isFinished || (m.hideAfterMs !== undefined && now < m.hideAfterMs)
  );
  const footybiteResults = await Promise.all(
    activeEspn.map(async (m) => ({
      key: teamKey(m.homeTeam.name, m.awayTeam.name),
      sources: await getFootybiteStreams(m.homeTeam.name, m.awayTeam.name),
    }))
  );
  const footybiteMap = new Map(footybiteResults.map((r) => [r.key, r.sources]));

  // Combine all sources: custom → footybite → sportek → streamed.pk
  const allMatches: ESPNMatch[] = espnMatches.map((m) => {
    const key = teamKey(m.homeTeam.name, m.awayTeam.name);
    const custom = getCustomStreams(m.homeTeam.name, m.awayTeam.name);
    const footybite = footybiteMap.get(key) ?? [];
    const sportekUrl = sportekUrls.get(key);
    const sportek: MatchSource[] = sportekUrl
      ? [{ source: "sportek", id: `sportek-${key}`, url: sportekUrl }]
      : [];
    const streamed = streamLookup.get(key) ?? [];
    return { ...m, sources: [...custom, ...footybite, ...sportek, ...streamed] };
  });

  const past = allMatches.filter(
    (m) => m.isFinished && (m.hideAfterMs === undefined || now >= m.hideAfterMs) && m.score !== undefined
  );
  const active = allMatches.filter(
    (m) => !m.isFinished || (m.hideAfterMs !== undefined && now < m.hideAfterMs)
  );

  // matchKeyToId for bracket panel highlight/scroll
  const matchKeyToId: Record<string, string> = {};
  for (const m of allMatches) {
    matchKeyToId[teamKey(m.homeTeam.name, m.awayTeam.name)] = m.id;
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #0d1a3a 0%, #090d1f 30%, #050508 60%, #080d0a 100%)" }}>
      <RefreshLive />

      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-35" style={{ background: "radial-gradient(ellipse, #92400e 0%, transparent 65%)" }} />
        <div className="absolute -top-10 -left-32 w-[700px] h-[700px] rounded-full opacity-25" style={{ background: "radial-gradient(ellipse, #1e3a8a 0%, transparent 65%)" }} />
        <div className="absolute bottom-0 -right-40 w-[700px] h-[700px] rounded-full opacity-20" style={{ background: "radial-gradient(ellipse, #064e3b 0%, transparent 65%)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] rounded-full opacity-10" style={{ background: "radial-gradient(ellipse, #1d4ed8 0%, transparent 70%)" }} />
      </div>

      <AppHeader bracketData={bracketData} matchKeyToId={matchKeyToId} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-3">
        {past.length === 0 && active.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-20">No matches found.</p>
        )}

        {past.map((m) => (
          <div key={m.id} id={`match-${m.id}`} style={{ scrollMarginTop: "96px" }}>
            <PastMatchCard match={m} />
          </div>
        ))}

        {/* NOW divider — always shown after past matches */}
        {past.length > 0 && (
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
            {active.length === 0 && (
              <p className="text-center text-sm py-6" style={{ color: "rgba(255,255,255,0.35)" }}>
                {streamsDown
                  ? "Streams unavailable — streamed.pk may be down. Retrying shortly."
                  : "No live streams right now — check back closer to kick-off."}
              </p>
            )}
          </>
        )}

        {active.map((m) => (
          <div key={m.id} id={`match-${m.id}`} style={{ scrollMarginTop: "96px" }}>
            <MatchCard
              match={m}
              isLive={m.isLive || (m.isFinished && m.hideAfterMs !== undefined && now < m.hideAfterMs)}
            />
          </div>
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
