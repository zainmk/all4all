import Link from "next/link";
import { LEAGUES, LEAGUE_ORDER, type LeagueId } from "@/lib/leagues";

export function AppHeader({ active }: { active: LeagueId }) {
  return (
    <header
      className="sticky top-0 z-20 border-b border-white/5 backdrop-blur-xl"
      style={{ background: "rgba(5,5,8,0.75)" }}
    >
      <nav
        aria-label="League"
        className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center gap-2"
      >
        {LEAGUE_ORDER.map((id) => {
          const league = LEAGUES[id];
          const isActive = id === active;
          return (
            <Link
              key={id}
              href={league.href}
              aria-current={isActive ? "page" : undefined}
              title={isActive ? undefined : `Switch to ${league.label}`}
              className={`flex items-center gap-3 select-none rounded-xl px-3 py-1.5 transition-all duration-200 ${
                isActive ? "opacity-100" : "opacity-40 hover:opacity-90"
              }`}
              style={{
                background: isActive ? `rgba(${league.accent},0.07)` : "transparent",
                border: `1px solid ${isActive ? `rgba(${league.accent},0.22)` : "transparent"}`,
              }}
            >
              <img
                src={league.logo}
                alt={league.logoAlt}
                className="h-9 w-auto"
                style={{
                  filter: isActive
                    ? `drop-shadow(0 0 12px rgba(${league.accent},0.5))`
                    : undefined,
                }}
              />
              {isActive && (
                <h1
                  className="text-base font-black tracking-widest uppercase"
                  style={{
                    color: `rgb(${league.accent})`,
                    textShadow: `0 0 20px rgba(${league.accent},0.35)`,
                  }}
                >
                  {league.label}
                </h1>
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
