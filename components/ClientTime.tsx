"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * A timestamp shown in the *viewer's* own timezone, always with the zone
 * abbreviation ("11:00 AM MDT") so it's never ambiguous.
 *
 * Times are formatted with `toLocaleTimeString`, which uses whatever timezone
 * the runtime is in. During SSR that's the server's zone (UTC on Vercel), not
 * the viewer's — so the server-rendered value can be wrong. Flipping a state
 * flag in an effect forces one client re-render after hydration, at which point
 * the browser's own (DST-aware) zone produces the authoritative value.
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
  const [, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const d = new Date(value);
  const prefix = weekday ? `${d.toLocaleDateString("en-US", { weekday: "short" })} ` : "";
  const time = d.toLocaleTimeString("en-US", {
    hour: pad ? "2-digit" : "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <span className={className} style={style} suppressHydrationWarning>
      {prefix}
      {time}
    </span>
  );
}
