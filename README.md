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

## Data

Four fictional Scottish clubs with different strengths, 18 generated players
each. Squads are generated deterministically from the club id, so a club always
fields the same team. Team ratings are derived from the players, not typed in.

Real clubs and players replace this by swapping `src/data/` — nothing
downstream knows where a `Player[]` came from.
