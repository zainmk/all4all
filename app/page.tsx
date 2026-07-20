"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LEAGUES } from "@/lib/leagues";
import { readStoredLeague } from "@/lib/league-storage";

/** League to open for a first-time visitor — whichever is in season. */
const DEFAULT_LEAGUE = "wnba" as const;

/**
 * "/" is a client-side hop to the league the user last viewed. It has to run in
 * the browser because the choice lives in localStorage, which the server can't
 * see — so this renders nothing and redirects on mount.
 */
export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const league = readStoredLeague() ?? DEFAULT_LEAGUE;
    router.replace(LEAGUES[league].href);
  }, [router]);

  return null;
}
