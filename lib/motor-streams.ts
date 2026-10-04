import type { Match, MatchSource, RaceEvent } from "@/types";

/**
 * streamed.pk lists motorsport streams per *session* (Moto3, Moto2, MotoGP race;
 * or an F1 session), all under the "motor-sports" category with no structured
 * link to a calendar round. This matches those streams to our race rounds by the
 * circuit/Grand-Prix name embedded in the stream's title + source ids, and labels
 * each badge by its class so a MotoGP weekend shows "MotoGP / Moto2 / Moto3".
 */

export type RaceSeries = "motogp" | "f1";

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Title plus the source ids — the ids reliably carry the class ("…-moto2-…",
// "…-formula-1-…") even when the title doesn't.
function textOf(m: Match): string {
  return `${m.title} ${m.sources.map((s) => s.id).join(" ")}`.toLowerCase();
}

/** Which series a motor-sports entry belongs to; null for NASCAR/IndyCar/etc. */
function seriesOf(m: Match): RaceSeries | null {
  const t = textOf(m);
  if (/moto ?gp|motogp|moto ?2|moto ?3/.test(t)) return "motogp";
  if (/formula ?1|formula-1|\bf1\b/.test(t)) return "f1";
  return null;
}

function classLabel(m: Match): string {
  const t = textOf(m);
  if (/moto ?gp|motogp/.test(t)) return "MotoGP";
  if (/moto ?2|moto2/.test(t)) return "Moto2";
  if (/moto ?3|moto3/.test(t)) return "Moto3";
  if (/formula ?1|formula-1|\bf1\b/.test(t)) return "F1";
  return "Live";
}

// Premier class first, then the support classes.
const CLASS_RANK: Record<string, number> = { MotoGP: 0, F1: 0, Moto2: 1, Moto3: 2, Live: 3 };

/** Identifiers to match a stream against: the circuit place and the GP name. */
function roundKeys(round: Pick<RaceEvent, "name" | "place">): string[] {
  const gp = round.name.replace(/grand prix of|grand prix/gi, "");
  return [round.place, gp].map(norm).filter((k) => k.length >= 4);
}

/** Keep only the motor-sports entries (streamed.pk has no teams on these). */
export function motorSportsMatches(matches: Match[]): Match[] {
  return matches.filter((m) => m.category?.toLowerCase() === "motor-sports");
}

/** streamed.pk stream sources for one round, labeled by class, premier first. */
export function motorStreamsForRound(
  round: Pick<RaceEvent, "name" | "place">,
  motorMatches: Match[],
  series: RaceSeries
): MatchSource[] {
  const keys = roundKeys(round);
  if (keys.length === 0) return [];

  const ranked: Array<MatchSource & { rank: number }> = [];
  const seen = new Set<string>();
  for (const m of motorMatches) {
    if (seriesOf(m) !== series) continue;
    const t = norm(textOf(m));
    if (!keys.some((k) => t.includes(k))) continue;
    const label = classLabel(m);
    for (const s of m.sources) {
      const dedup = `${s.source}:${s.id}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      ranked.push({ source: s.source, id: s.id, label, rank: CLASS_RANK[label] ?? 9 });
    }
  }
  ranked.sort((a, b) => a.rank - b.rank);

  // One badge for the whole weekend, labelled by the series ("MotoGP" / "F1"),
  // pointing at the best session stream available: the premier race once it's up,
  // otherwise the next-best class (Moto2 → Moto3). The support feeds are the
  // fallback *behind* the single badge, not separate badges.
  const best = ranked[0];
  if (!best) return [];
  return [{ source: best.source, id: best.id, label: series === "f1" ? "F1" : "MotoGP" }];
}
