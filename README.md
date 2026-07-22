# all4all

Live and upcoming games for a handful of leagues, on one page — scores from ESPN,
streams aggregated from a few public sources, sorted chronologically around a
"Now" marker.

## Leagues

| Route     | League  | Shape                                        |
| --------- | ------- | -------------------------------------------- |
| `/wnba`   | WNBA    | Fixtures — two teams, a score                 |
| `/motogp` | MotoGP  | Race calendar — one card per Grand Prix weekend, with podium |
| `/f1`     | F1      | Race calendar — same shape as MotoGP          |
| `/fifa`   | FIFA 26 | Fixtures (off season)                         |

`/` redirects to whichever league is in season. To change it, edit the redirect in
[`next.config.ts`](next.config.ts).

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## How it's put together

Everything league-specific lives in [`lib/leagues.ts`](lib/leagues.ts) — accent
colour and page gradient, logo, stream click-through priority, and per-sport data
settings. It's a discriminated union on `kind`:

- `kind: "team"` — ESPN-backed fixtures, rendered by
  [`LeaguePage`](components/LeaguePage.tsx) with
  [`MatchCard`](components/MatchCard.tsx) / [`PastMatchCard`](components/PastMatchCard.tsx).
- `kind: "race"` — a season calendar, rendered by
  [`RacePage`](components/RacePage.tsx) with [`RaceCard`](components/RaceCard.tsx).

Both share [`PageShell`](components/PageShell.tsx), which owns the gradient, ambient
blobs, header, the past → NOW → upcoming layout, and the footer. Adding a league is
a config entry plus a two-line `app/<league>/page.tsx`.

### Data sources

- **[ESPN](lib/espn.ts)** — scores, fixtures, team logos, venues. Public scoreboard
  API, no auth.
- **[totalsportek](lib/sportek.ts)** — scrapes today/tomorrow listings for stream
  page URLs. Matches by team pair, falling back to nicknames and reversed
  home/away ordering.
- **[streamed.pk](lib/api.ts)** — `admin` and `echo` stream sources.
- **[footybite](lib/footybite.ts)** — English-language broadcast feeds. Soccer only.
- **[motogp.com](lib/motogp.ts)** — race calendar, circuits and podiums, via the
  public `api.motogp.pulselive.com` endpoints. Podium lookup is three chained calls
  (categories → sessions → classification) so it only runs for finished rounds, and
  those results are cached for a day since they never change.
- **[jolpica / Ergast](lib/f1.ts)** — F1 calendar, results and standings. Session
  results (qualifying/sprint/race) are one call each per finished round; jolpica
  rate-limits bursts, so `getF1Season` paces them with `mapLimit` and skips the
  sprint call on non-sprint weekends. Standings movement (▲▼) is computed by diffing
  the two most recent rounds, since the API doesn't report it.

Both race series render through the shared [`RacePage`](components/RacePage.tsx) /
[`RaceCard`](components/RaceCard.tsx) / [`StandingsCard`](components/StandingsCard.tsx);
[`lib/race-data.ts`](lib/race-data.ts) dispatches to the right provider by league id.

Team names differ across all of them, so matching goes through a normalized
`teamKey()` in [`lib/espn.ts`](lib/espn.ts), with per-source alias tables
([`lib/team-aliases.ts`](lib/team-aliases.ts), and the `NAME_MAP` /
`SLUG_OVERRIDES` constants in the scrapers). **When a stream doesn't show up for a
game, a name mismatch is the first thing to check** — add an alias rather than
special-casing.

MotoGP has the same problem in a different form: sportek names rounds by demonym
(`motogp-british-grand-prix`) while the API uses the country (`GRAND PRIX OF GREAT
BRITAIN`), so rounds are matched through `SPORTEK_ROUND_ALIASES` in
[`lib/motogp.ts`](lib/motogp.ts), keyed on the API's three-letter `short_name`.

One-off manual stream overrides go in
[`lib/custom-streams.ts`](lib/custom-streams.ts), keyed by team pair.

### Refreshing

Pages are ISR with a 30s revalidate, and [`RefreshLive`](components/RefreshLive.tsx)
calls `router.refresh()` on the same interval so scores tick over without a reload.

Stream badges are deliberately hidden until 30 minutes before kick-off / tip-off,
and disappear 30 minutes after a game ends.
