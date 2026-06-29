"use client";

import { useState } from "react";
import { BracketPanel } from "@/components/BracketPanel";
import type { BracketData } from "@/lib/bracket";

export function AppHeader({
  bracketData,
  matchKeyToId,
}: {
  bracketData: BracketData;
  matchKeyToId: Record<string, string>;
}) {
  const [showBracket, setShowBracket] = useState(false);

  function handleMatchClick(matchId: string) {
    setShowBracket(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document
          .getElementById(`match-${matchId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
        window.dispatchEvent(
          new CustomEvent("highlightMatch", { detail: { matchId } })
        );
      });
    });
  }

  return (
    <>
      <header
        className="sticky top-0 z-20 border-b border-white/5 backdrop-blur-xl cursor-pointer"
        style={{ background: "rgba(5,5,8,0.75)" }}
        onClick={() => setShowBracket((prev) => !prev)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center gap-3">
          <div className="flex items-center gap-3 select-none">
            <img
              src="/fifa26-logo.png"
              alt="FIFA 26"
              className="h-9 w-auto drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]"
            />
            <h1 className="text-base font-black tracking-widest text-white uppercase drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
              <span className="text-amber-400">FIFA26</span>
            </h1>
          </div>
        </div>
      </header>

      {showBracket && (
        <>
          <div
            className="fixed inset-0 z-10"
            style={{ top: 73 }}
            onClick={() => setShowBracket(false)}
          />
          <div className="fixed left-0 right-0 z-20" style={{ top: 73 }}>
            <BracketPanel
              data={bracketData}
              matchKeyToId={matchKeyToId}
              onMatchClick={handleMatchClick}
            />
          </div>
        </>
      )}
    </>
  );
}
