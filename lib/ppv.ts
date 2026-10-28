import type { ESPNMatch, MatchSource, RaceEvent } from "@/types";
import { teamKey } from "@/lib/espn";

// ppv.st's public API, documented at ppv.st/api. Its rules allow server-side
// use "with sensible caching to avoid aggressive polling", so the stream list is
// fetched at most every 5 minutes and shared by every page through Next's cache.
// (Its other rule — no tampering with ppv's embeds — is why we only link out.)
//
// ppv rotates domains. GET /api/ping lists the current mirrors and the docs say
// the API answers on every one (at api.<domain>), so the first mirror that
// responds serves both the API call and the links. KNOWN_DOMAINS seeds that in
// case the primary is already gone: it's /api/ping's answer as of Oct 2026, when
// only ppv.st was actually reachable — refresh it if links start failing.
const KNOWN_DOMAINS = ["ppv.st", "ppv.tj", "ppvs.pk", "ppv.rw", "ppv.ms", "ppv.bi", "ppv.ug"];

const STREAMS_TTL = 300;
const PING_TTL = 86_400;
// Each attempt is capped and the backups are tried together, so even a hanging
// API costs a render ~6s at worst (primary + mirrors) rather than stalling it.
const ATTEMPT_TIMEOUT_MS = 3_000;
const MAX_BACKUPS = 3;

// A team game's listing and ESPN's tip-off are the same instant in practice; the
// slack only has to stay clear of the same two teams' next meeting.
const MATCH_WINDOW_MS = 12 * 3_600_000;

export interface PpvStream {
  name: string;
  tag: string;
  category: string;
  uri: string;
  start: number;
  end: number;
  /** 24/7 channels: no real start/end, never tied to one event */
  alwaysLive: boolean;
}

export interface PpvFeed {
  /** Site origin the links point at, e.g. "https://ppv.st" */
  site: string;
  streams: PpvStream[];
}

async function getJSON(url: string, revalidate: number): Promise<unknown> {
  try {
    const res = await fetch(url, {
      next: { revalidate },
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Mirror domains, best first: ppv's live list when reachable, plus the known ones. */
async function mirrors(): Promise<string[]> {
  const ping = (await getJSON(`https://api.${KNOWN_DOMAINS[0]}/api/ping`, PING_TTL)) as {
    domains?: unknown;
  } | null;
  const live = Array.isArray(ping?.domains)
    ? ping.domains.filter((d): d is string => typeof d === "string" && /^[a-z0-9.-]+$/i.test(d))
    : [];
  return [...new Set([...live, ...KNOWN_DOMAINS])];
}

interface RawStream {
  name?: unknown;
  tag?: unknown;
  category_name?: unknown;
  uri_name?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  always_live?: unknown;
}

function parseStreams(data: unknown): PpvStream[] | null {
  const categories = (data as { streams?: unknown } | null)?.streams;
  if (!Array.isArray(categories)) return null;
  const out: PpvStream[] = [];
  for (const cat of categories as Array<{ category?: unknown; streams?: unknown }>) {
    for (const s of (Array.isArray(cat.streams) ? cat.streams : []) as RawStream[]) {
      if (typeof s.name !== "string" || typeof s.uri_name !== "string") continue;
      out.push({
        name: s.name,
        tag: typeof s.tag === "string" ? s.tag : "",
        category: String(cat.category ?? s.category_name ?? ""),
        uri: s.uri_name,
        start: Number(s.starts_at) * 1000,
        end: Number(s.ends_at) * 1000,
        alwaysLive: Number(s.always_live) === 1,
      });
    }
  }
  return out;
}

async function fromMirror(domain: string): Promise<PpvFeed | null> {
  const streams = parseStreams(await getJSON(`https://api.${domain}/api/streams`, STREAMS_TTL));
  return streams ? { site: `https://${domain}`, streams } : null;
}

/** ppv.st's current listing, or null when no mirror answers. */
export async function getPpvFeed(): Promise<PpvFeed | null> {
  const primary = KNOWN_DOMAINS[0];
  // The primary's streams and its mirror list are asked for together, so a dead
  // primary costs one timeout before the backups are tried — all at once.
  const [feed, domains] = await Promise.all([fromMirror(primary), mirrors()]);
  if (feed) return feed;
  const backups = domains.filter((d) => d !== primary).slice(0, MAX_BACKUPS);
  return Promise.any(
    backups.map((d) => fromMirror(d).then((f) => f ?? Promise.reject(new Error("no feed"))))
  ).catch(() => null);
}

function link(site: string, uri: string): MatchSource {
  return { source: "ppv", id: `ppv-${uri}`, url: `${site}/live/${uri}` };
}

// ppv titles team games "Away vs. Home"
const VS = /\s+(?:vs\.?|v\.?|@|at)\s+/i;

/** The listed ppv.st page for a team game: same league tag, both teams, start within 12h. */
export function ppvForMatch(
  feed: PpvFeed,
  tag: string,
  match: Pick<ESPNMatch, "date" | "homeTeam" | "awayTeam">
): MatchSource[] {
  const want = teamKey(match.homeTeam.name, match.awayTeam.name);
  const wantFlipped = teamKey(match.awayTeam.name, match.homeTeam.name);
  const hit = feed.streams.find((s) => {
    if (s.tag.toLowerCase() !== tag.toLowerCase()) return false;
    if (Math.abs(s.start - match.date) > MATCH_WINDOW_MS) return false;
    const [away, home] = s.name.split(VS);
    if (!away || !home) return false;
    const key = teamKey(home, away);
    return key === want || key === wantFlipped;
  });
  return hit ? [link(feed.site, hit.uri)] : [];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The ppv.st page for a race weekend: a listing whose tag or title names the
 * series and whose time falls in the weekend. ppv lists sessions separately, so
 * the one live now wins, then the next to start, then the most recent.
 */
export function ppvForRound(
  feed: PpvFeed,
  keywords: string[],
  round: Pick<RaceEvent, "dateStart" | "dateEnd" | "raceStart">,
  now: number
): MatchSource[] {
  const series = new RegExp(`\\b(?:${keywords.map(escapeRe).join("|")})\\b`, "i");
  // Weekend from first practice to the race's finish. MotoGP's dateEnd is a bare
  // date (midnight), so allow a day past it as well as a few hours past lights out.
  const from = round.dateStart - 6 * 3_600_000;
  const to = Math.max(round.dateEnd + 24 * 3_600_000, (round.raceStart ?? 0) + 4 * 3_600_000);
  const inWeekend = feed.streams.filter(
    (s) => !s.alwaysLive && s.start <= to && s.end >= from && series.test(`${s.tag} ${s.name}`)
  );
  if (inWeekend.length === 0) return [];
  const live = inWeekend.find((s) => s.start <= now && now <= s.end);
  const next = inWeekend.filter((s) => s.start > now).sort((a, b) => a.start - b.start)[0];
  const latest = [...inWeekend].sort((a, b) => b.start - a.start)[0];
  return [link(feed.site, (live ?? next ?? latest).uri)];
}

// Fallback when the API is unreachable, for leagues whose URL pattern has been
// checked against real listings: /live/<league>/<US Eastern date>/<away>-<home>,
// ESPN's abbreviations lower-cased ("nba/2026-10-27/bkn-bos" — 16/16 matched in
// Oct 2026). The date is the Eastern calendar day even for a 10pm-ET tip-off.
const easternDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** A ppv.st link built from ESPN's data, without the API. */
export function ppvBuiltLink(
  leaguePath: string,
  match: Pick<ESPNMatch, "date" | "homeTeam" | "awayTeam">
): MatchSource[] {
  const away = match.awayTeam.abbrev?.toLowerCase();
  const home = match.homeTeam.abbrev?.toLowerCase();
  if (!away || !home || !match.date) return [];
  return [link(`https://${KNOWN_DOMAINS[0]}`, `${leaguePath}/${easternDate.format(match.date)}/${away}-${home}`)];
}
