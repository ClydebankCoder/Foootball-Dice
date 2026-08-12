# Football Dice

A football management prototype built around one mechanic:

> **Every meaningful action shows its probability before you commit, and its D100 roll after.**

You see `THROUGH BALL — 64%`, you see exactly which attributes, tactics and
opposition ratings produced that 64, you commit, and then you watch a real
1–100 die land. `roll <= probability` succeeds. Nothing is decided off-screen.

Every action a player could plausibly attempt is on the menu, however unlikely.
The 3% rabona sits directly below the 93% short pass, and if you roll a 2, it
comes off.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

Other commands:

```bash
npm test           # engine tests (vitest)
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
npm run typecheck  # types only
```

No configuration or account is needed to play. Your career is saved to
`localStorage` on the device.

## Deploying

`netlify.toml` is set up: build `npm run build`, publish `dist`, with an SPA
redirect. Connect the repository to Netlify and it will work as-is.

## How the mechanic works

**Probability** (`src/engine/probability.ts`) is never "player rating =
chance". It is itemised, and every line is shown to the player:

```
Base chance            14%
Vision                 +3%
Technique              +5%
Flair                  +2%
Opposition defence     -5%
Pressure on the ball   -3%
Very attacking mentality +4%
Fatigue                -1%
Away from home         -2%
─────────────────────────
FINAL                  17%
```

Final probabilities are clamped to **1–99**. Certainty in either direction
would break the whole premise, so it is enforced in the engine rather than at
call sites.

**The roll** (`src/engine/random.ts`, `src/engine/resolve.ts`) is a genuine
integer from 1 to 100 — not a float dressed up as a percentage. `resolveAction`
accepts an injected roll (`resolveAction(action, context, 50)`) so boundary
behaviour is tested exactly rather than statistically.

**Outcome bands** go beyond pass/fail — critical success, success, partial
success, failure, critical failure. They are strictly *nested inside* the
headline rule: a critical success is always a success, a partial success is
always a failure. The banding can be enriched without the rule the player was
shown ever changing under them.

**Criticals carry.** A critical success hands the next decision in the same
passage of play a bonus ("Defence scrambling", +10%); a critical failure while
defending costs you one ("Caught out of position", −8%). It applies to the
following decision only, and it appears in that decision's breakdown by name
like every other modifier — a bonus the player cannot see would defeat the
point. Ordinary successes carry nothing, which is what keeps a critical
feeling like an event.

## Layout

```
src/
  engine/      probability, D100, resolution, situations, actions,
               match engine, league — no React anywhere in here
  data/        clubs, generated squads, and the composition of the two
  state/       career + localStorage persistence
  components/  probability bar, dice, action list, breakdown, table…
  pages/       club select, dashboard, squad, tactics, match, match report
  types/       domain types, shaped like the Supabase tables
  utils/       presentation helpers
supabase/
  schema.sql   the tables this is heading for
```

The engine is pure: state in, state out, no timers and no DOM. The match screen
decides *when* to call it; the engine decides what happens.

Randomness is confined to `src/engine/random.ts`. Matches carry a seed and a
cursor, so a match is replayable and could later be handed to a
server-authoritative roller without the engine changing.

## Supabase

Optional, and off by default. Set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` (see `.env.example`) and apply `supabase/schema.sql`.
Without them, `supabase` is `null` and the app runs on local storage — so an
incomplete auth flow can never block playtesting.

The schema covers clubs, players, managers, fixtures and `match_events`. That
last table stores the probability shown and the roll received for every
decision, which is both the audit trail behind the game's promise and the
foundation for manager records ("lowest probability ever converted").

## Seasons, promotion and relegation

All four SPFL divisions exist: Premiership (12), Championship, League One and
League Two (10 each), 42 clubs in total. You can take any of them.

A season is a double round robin — everyone home and away, so 22 matches in the
Premiership and 18 below it. At the end of it:

- the champion of each division below the top goes up
- the bottom club of each division above the bottom goes down
- League Two's bottom club stays (there is no pyramid beneath it here)

The three divisions you are *not* in are simulated in full at the final whistle
rather than tracked week by week — same ratings, same dice, same upsets, just
resolved in one go. That is what makes a club coming up have somewhere to come
from. Then the pyramid is rebuilt, your record is filed, and the next season's
fixtures are generated.

Play-offs are not implemented: it is one automatic promotion and one automatic
relegation per division, not the real 2nd-to-4th play-off. `PROMOTION_PLACES`
and `RELEGATION_PLACES` in `src/engine/season.ts` are the knobs.

## Data

42 real SPFL clubs — names, home grounds and colours only. No crests, which are
the part that is actually trademarked, and players stay fictional rather than
bringing image rights into a prototype.

Each club carries a `profile` (attack/midfield/defence/goalkeeping on the same
1–100 scale as player attributes). An 18-player squad is generated
deterministically from the club id, so a club always fields the same team, and
team ratings are derived back out of that squad rather than typed in.

Which division a club starts in changes every May. `src/data/clubs.ts` reflects
2025-26 as I have it — correcting a placing is a one-word edit to that club's
`league` field. The ratings are judgement calls for playability, not a ranking,
and they are meant to be tuned.
