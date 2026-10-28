"use client";

import { useSyncExternalStore, type CSSProperties } from "react";

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true once the page is live in the
 * browser. Anything shown in the *viewer's* timezone has to wait for it: the
 * server only knows its own zone (UTC on Vercel). Merely re-rendering after
 * mount doesn't fix that — the re-render produces the same output React already
 * recorded at hydration, so it never replaces the server's text in the DOM.
 * This value changes the output, so React does. Also the switch for anything
 * computed from the current time (countdowns), which a cached page can't know.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** Until hydration the value is in UTC — keep it in the layout but out of sight. */
function hiddenUntil(hydrated: boolean, style?: CSSProperties): CSSProperties | undefined {
  return hydrated ? style : { ...style, visibility: "hidden" };
}

/**
 * A timestamp shown in the viewer's own timezone, always with the zone
 * abbreviation ("11:00 AM MDT") so it's never ambiguous.
 */
export function ClientTime({
  value,
  weekday = false,
  pad = false,
  className,
  style,
}: {
  value: number;
  /** Prefix a short weekday, e.g. "Sun 7:00 AM MDT" (race sessions) */
  weekday?: boolean;
  /** Two-digit hour ("01:00 PM") vs numeric ("1:00 PM") */
  pad?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const hydrated = useHydrated();
  // UTC until hydrated, so the server and the hydrating browser render the same text
  const timeZone = hydrated ? undefined : "UTC";
  const d = new Date(value);
  const prefix = weekday ? `${d.toLocaleDateString("en-US", { weekday: "short", timeZone })} ` : "";
  const time = d.toLocaleTimeString("en-US", {
    hour: pad ? "2-digit" : "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  });

  return (
    <span className={className} style={hiddenUntil(hydrated, style)}>
      {prefix}
      {time}
    </span>
  );
}

/** Whether `ms` falls on today's date in `timeZone` (the runtime's zone when omitted). */
function isToday(ms: number, timeZone?: string): boolean {
  const day = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone });
  return day(ms) === day(Date.now());
}

/** A date in the viewer's timezone — "Tue, Oct 27", or "Today" with `relative`. */
export function ClientDate({
  value,
  relative = false,
  className,
  style,
}: {
  value: number;
  relative?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const hydrated = useHydrated();
  const timeZone = hydrated ? undefined : "UTC";
  const text =
    relative && isToday(value, timeZone)
      ? "Today"
      : new Date(value).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone });

  // "Today" can differ between a cached server render and hydration if UTC
  // midnight passed in between; the hidden value is replaced right after anyway.
  return (
    <span className={className} style={hiddenUntil(hydrated, style)} suppressHydrationWarning>
      {text}
    </span>
  );
}
