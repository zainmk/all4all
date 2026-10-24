import Link from "next/link";
import { LEAGUES, LEAGUE_ORDER, type LeagueId } from "@/lib/leagues";

export function AppHeader({ active }: { active: LeagueId }) {
  // Slide the row so the active chip lands dead centre instead of the group
  // being centred as a whole. Chips are a fixed width, so the offset is just
  // how many chip-widths the active one sits from the middle.
  const centerIndex = (LEAGUE_ORDER.length - 1) / 2;
  const activeIndex = LEAGUE_ORDER.indexOf(active);
  // A league with no chip (e.g. /fifa between tournaments) keeps the row centred
  const shift = activeIndex < 0 ? 0 : centerIndex - activeIndex;

  return (
    <header
      className="sticky top-0 z-20 border-b border-white/5 backdrop-blur-xl"
      style={{ background: "rgba(5,5,8,0.75)" }}
    >
      <nav
        aria-label="League"
        className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center"
      >
        <div
          className="league-switcher flex items-center gap-1 sm:gap-2"
          style={{ "--shift": shift } as React.CSSProperties}
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
              // Equal-width chips from sm up; widths step down so every chip
              // fits without overflowing. Phones can't fit equal chips with a
              // legible wordmark, so there square logos take a compact chip and
              // the wide wordmarks share what's left.
              className={`flex items-center justify-center gap-2.5 select-none rounded-xl ${
                league.logoIsWordmark ? "w-20" : "w-12"
              } sm:w-26 lg:w-44 px-2 sm:px-3 py-2 transition-all duration-200 ${
                isActive ? "opacity-100" : "opacity-45 hover:opacity-90"
              }`}
              style={{
                background: isActive ? `rgba(${league.accent},0.10)` : "transparent",
                border: `1px solid ${isActive ? `rgba(${league.accent},0.35)` : "1px solid transparent"}`,
                boxShadow: isActive
                  ? `0 2px 14px rgba(${league.accent},0.14), inset 0 1px 0 rgba(255,255,255,0.05)`
                  : "none",
              }}
            >
              <img
                src={league.logo}
                alt={league.logoAlt}
                // Wide wordmarks (F1 4:1, MotoGP 6.25:1) fill the chip and are
                // height-capped; icon marks stay compact beside their text label.
                className={
                  league.logoIsWordmark
                    ? "h-6 md:h-7 w-full object-contain"
                    : "h-8 w-auto max-w-full lg:max-w-[42%] object-contain shrink-0"
                }
                style={{
                  filter: isActive
                    ? `drop-shadow(0 0 10px rgba(${league.accent},0.45))`
                    : undefined,
                }}
              />
              {isActive && (
                league.logoIsWordmark ? (
                  // Logo carries the name already — keep the heading for
                  // screen readers only so it isn't printed twice.
                  <h1 className="sr-only">{league.label}</h1>
                ) : (
                  <h1
                    // Hidden until the chips are wide enough to hold it beside
                    // the logo, but kept in the a11y tree rather than display:none.
                    className="sr-only lg:not-sr-only text-base font-black tracking-widest uppercase whitespace-nowrap"
                    style={{
                      color: `rgb(${league.accent})`,
                      textShadow: `0 0 20px rgba(${league.accent},0.35)`,
                    }}
                  >
                    {league.label}
                  </h1>
                )
              )}
            </Link>
          );
        })}
        </div>
      </nav>
    </header>
  );
}
