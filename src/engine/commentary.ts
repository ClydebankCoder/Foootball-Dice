/**
 * Football descriptions for outcomes.
 *
 * Pools rather than fixed strings, because the same sentence twice in one
 * match breaks the illusion faster than any missing feature.
 */

import type { ActionCategory, MatchAction, OutcomeBand } from '../types';
import { pick, type Rng } from './random';

export interface CommentaryNames {
  actor: string;
  opponent: string;
  keeper: string;
}

type Pool = Record<ActionCategory, string[]>;

const CRITICAL_SUCCESS: Pool = {
  pass: [
    '{actor} plays it with the outside of the boot and it could not have been weighted better.',
    'Perfect. {actor} takes four defenders out of the game with one pass.',
    '{actor} sees it before anyone else in the stadium and the pass is inch-perfect.',
  ],
  dribble: [
    '{actor} leaves {opponent} on the deck and glides away from two more.',
    'Ridiculous feet from {actor}. {opponent} is still turning.',
    '{actor} goes through the lot of them.',
  ],
  shot: [
    'Off the underside of the bar and in. {actor} has hit that perfectly.',
    'Top corner. {keeper} does not move. {actor} will not score a better one.',
    'Unstoppable. {actor} finds the postage stamp.',
    'Into the roof of the net. {actor} has absolutely leathered that.',
    'It flies in off the far post. Perfect placement from {actor}.',
    'That is a goal-of-the-season contender from {actor}.',
  ],
  cross: [
    '{actor} hangs it up on a plate. That is a training-ground delivery.',
    'Whipped in by {actor} with pace and bend — impossible to defend.',
    '{actor} picks out the run without even looking up.',
  ],
  defend: [
    '{actor} reads it a full second early and comes away with the ball and the crowd.',
    'Magnificent from {actor}. Ball first, all momentum, straight back on the attack.',
    '{actor} snuffs it out so cleanly {opponent} is left appealing to nobody.',
  ],
  keep: [
    '{actor} kills the tempo completely and the whole team gets a breather.',
    'Ice cold from {actor}. The game slows to exactly the speed you wanted.',
    '{actor} shields it, wins the foul, and the noise drops.',
  ],
};

const SUCCESS: Pool = {
  pass: [
    '{actor} threads it between the centre-back and the full-back.',
    '{actor} slides the pass in behind and the run is timed right.',
    'Neat from {actor} — the ball is worked past {opponent}.',
    '{actor} finds the pass through the line.',
  ],
  dribble: [
    '{actor} knocks it past {opponent} and gets there first.',
    'A drop of the shoulder and {actor} is away from {opponent}.',
    '{actor} rides the challenge and drives on.',
  ],
  shot: [
    '{actor} strikes it low and hard past {keeper}.',
    '{keeper} gets a hand to it but cannot keep it out — {actor} has scored.',
    '{actor} makes no mistake. Bottom corner.',
    'Across the keeper and in. {actor} finishes it off.',
    '{actor} picks the far corner and {keeper} has no chance.',
    'Emphatic from {actor}. High into the net.',
    '{actor} takes a touch and slots it beyond {keeper}.',
    'Clean strike, and it is past {keeper} before the dive even begins.',
  ],
  cross: [
    '{actor} clips it into the danger area and there is a head on the end of it.',
    'The delivery from {actor} beats the first man and drops perfectly.',
    '{actor} gets it in behind the defence.',
  ],
  defend: [
    '{actor} gets across and takes it cleanly off {opponent}.',
    'Well judged by {actor} — the danger is gone.',
    '{actor} stands it up, wins the ball, and the move dies.',
  ],
  keep: [
    '{actor} keeps possession and the shape resets.',
    'Sensible from {actor}. The ball is retained.',
    '{actor} plays the simple one and it is exactly right.',
  ],
};

const PARTIAL: Pool = {
  pass: [
    '{actor} finds the pass but the weight is heavy and it runs away.',
    'Almost. {opponent} gets the faintest touch and diverts it behind.',
    '{actor} picks the runner out but the flag is up.',
  ],
  dribble: [
    '{actor} gets past {opponent} but is bundled off it a stride later.',
    'Half a yard short — {actor} pokes it through and cannot reach it.',
    '{actor} beats the man and then runs into traffic.',
  ],
  // The "so close" band counts as a shot on target, so everything here has to
  // be a save or the woodwork — blocks and wild misses belong further down.
  shot: [
    '{keeper} gets down low and pushes it away for a corner.',
    '{keeper} makes a good save — strong hands, and it is behind for a corner.',
    'Off the post and back into play. {actor} cannot believe it.',
    '{actor} tests {keeper}, who parries and gathers at the second attempt.',
    'A fine stop. {keeper} gets fingertips to it and turns it round the upright.',
    'Straight at {keeper}, who holds it comfortably. Well struck, badly placed.',
    'It beats {keeper} and comes back off the underside of the bar. Scrambled clear.',
    '{actor} forces {keeper} into a diving save at full stretch.',
    'Off the inside of the post and along the goal line. Somehow it stays out.',
    '{keeper} stands tall and blocks it with a trailing leg. Brilliant goalkeeping.',
  ],
  cross: [
    'The cross from {actor} is half cleared and only just scrambled away.',
    '{actor} gets it in but it is behind the runner.',
    'A touch too deep from {actor}, and the moment is gone.',
  ],
  defend: [
    '{actor} gets a toe in and it squirms out for a throw. Danger delayed, not gone.',
    '{opponent} goes past but {actor} recovers enough to force a poor ball.',
    'A scrambled block from {actor}. The attack keeps coming.',
  ],
  keep: [
    '{actor} holds it up but the pass out is cut off.',
    'The ball sticks under {actor}’s feet and possession is turned over cheaply.',
    '{actor} slows it down but gets caught in the corner.',
  ],
};

const FAILURE: Pool = {
  pass: [
    '{opponent} reads it and steps in front to intercept.',
    'Overhit by {actor}. Straight through to the goalkeeper.',
    '{actor} plays it into the one gap that was covered.',
    'The pass is cut out. {actor} knows it was the wrong ball.',
  ],
  dribble: [
    '{opponent} shepherds {actor} away and nicks it off the toe.',
    '{actor} takes one touch too many and the chance is gone.',
    'Well tackled by {opponent}. {actor} overran it.',
  ],
  // Off target or blocked — the keeper never has to make a save.
  shot: [
    '{actor} drags it wide of the far post.',
    'Over the bar. {actor} leaned back on that one.',
    '{actor} slices it and the ball drifts harmlessly out for a goal kick.',
    'Blocked. {opponent} throws a body in front of it at the last moment.',
    'Wide of the near post. {actor} picked the wrong side to aim for.',
    'Charged down by {opponent} before it ever gets going.',
    '{actor} snatches at it and the ball climbs over the crossbar.',
    'Dragged across the face of goal and out on the far side.',
    'Too high and too wide. {actor} knows it the moment it leaves the boot.',
    'It takes a nick off {opponent} and loops behind for a corner.',
  ],
  cross: [
    '{actor} finds the first defender. Cleared.',
    'The cross is too long and drifts out on the far side.',
    '{opponent} attacks it well and heads it clear.',
  ],
  defend: [
    '{opponent} skips past {actor} far too easily.',
    '{actor} commits early and gets nowhere near it.',
    'A shrug and a turn from {opponent} and {actor} is beaten.',
  ],
  keep: [
    '{actor} is closed down and loses it.',
    'Dispossessed. {actor} dithered on the ball.',
    '{opponent} presses and {actor} coughs it up.',
  ],
};

const CRITICAL_FAILURE: Pool = {
  pass: [
    'Dreadful from {actor}. Straight to {opponent} and your defence is exposed.',
    '{actor} hits it out of play for a throw thirty yards away. The groans are audible.',
    'A truly wretched pass from {actor}. That has invited them straight back on you.',
  ],
  dribble: [
    '{actor} tries to beat one too many and is robbed in a horrible area.',
    'Turned over by {opponent} in the worst possible spot. {actor} has to sprint back.',
    '{actor} falls over the ball. That is embarrassing.',
  ],
  shot: [
    '{actor} skies it into the away end. The crowd will remember that.',
    'Miscued horribly by {actor}. It ends up nearer the corner flag than the goal.',
    'That is dreadful. {actor} had time and made a mess of it.',
    '{actor} swings and barely connects. It dribbles through to {keeper}.',
    'Row Z. {actor} will not want to see that one again.',
    'Horrendous contact from {actor} — it goes out for a throw-in.',
  ],
  cross: [
    '{actor} slices it straight out for a goal kick.',
    'The delivery is so poor it goes behind for a throw on the other side.',
    '{actor} hits the corner flag. Genuinely.',
  ],
  defend: [
    '{actor} is done completely and now nobody is covering.',
    '{opponent} nutmegs {actor} and the back line is in bits.',
    'Awful from {actor} — sold themselves and left the door wide open.',
  ],
  keep: [
    '{actor} loses it in the worst area on the pitch and they are away.',
    'Careless in the extreme from {actor}. Straight to {opponent}.',
    '{actor} is caught dawdling and has gifted them possession.',
  ],
};

/**
 * Lines for specific actions.
 *
 * Two jobs, and they need different handling:
 *
 * - Most add texture. A header should miss like a header, so its lines are
 *   *added to* the category pool. Replacing the pool with two bespoke lines
 *   would make a header the most repetitive shot in the game.
 * - A few are corrections. "Round The Goalkeeper" is categorised as a dribble
 *   because that is mechanically what it is, so the dribble pool would have it
 *   failing like a midfield turnover. Those are marked `exclusive` and must
 *   carry a full set of bands of their own.
 */
interface ActionCommentary {
  /** Suppress the category pool entirely — it would read wrongly here. */
  exclusive?: boolean;
  lines: Partial<Record<OutcomeBand, string[]>>;
}

export const ACTION_LINES: Record<string, ActionCommentary> = {
  header: { lines: {
    'partial-success': [
      '{keeper} claws the header off the line.',
      'The header is straight at {keeper}, taken above the head.',
      'Downward header — and it bounces up onto the crossbar.',
    ],
    failure: [
      '{actor} gets over it but the header goes wide.',
      'The header is looped over the bar.',
      '{actor} cannot get enough contact and it drifts across goal.',
    ],
    'critical-failure': [
      '{actor} climbs above everybody and heads it into the side netting from six yards.',
    ],
  } },
  volley: { lines: {
    'partial-success': ['The volley is arrowing in until {keeper} throws up a hand.'],
    failure: [
      '{actor} catches it wrong and the volley balloons over.',
      'Sweet contact, wrong direction — the volley flies wide.',
    ],
    'critical-failure': [
      '{actor} swings through thin air. The ball bounces away untouched.',
    ],
  } },
  chip: { lines: {
    'partial-success': [
      'The chip beats {keeper} — and drops onto the roof of the net.',
      '{keeper} reads the chip and plucks it out of the air.',
    ],
    failure: ['{actor} gets right under it and the chip sails well over.'],
    'critical-failure': [
      'The chip barely leaves the ground. {keeper} collects it, almost embarrassed.',
    ],
  } },
  panenka: { lines: {
    'critical-success': [
      'Audacious beyond words. {actor} dinks it down the middle as {keeper} dives away.',
    ],
    'partial-success': ['{keeper} does not buy it, and catches the panenka dead centre.'],
    failure: [
      '{keeper} stands up, waits, and gathers the panenka without moving. Excruciating.',
    ],
    'critical-failure': [
      '{actor} scoops it so far over the bar it lands in the stand. Unforgettable, for the wrong reasons.',
    ],
  } },
  'bicycle-kick': { lines: {
    'critical-success': [
      'Unbelievable. {actor} hangs in the air and thrashes it past {keeper}.',
    ],
    'partial-success': ['The overhead kick is heading in until {keeper} tips it over.'],
    failure: [
      '{actor} gets the connection but it loops wide.',
      'Spectacular attempt, ordinary outcome — over the bar.',
    ],
    'critical-failure': ['{actor} lands in a heap, having missed the ball entirely.'],
  } },
  'backheel-finish': { lines: {
    'partial-success': ['{keeper} smothers the backheel on the line.'],
    failure: ['The backheel trickles wide of the post.'],
    'critical-failure': ['{actor} makes a total mess of the backheel and falls over.'],
  } },
  'long-shot': { lines: {
    'partial-success': [
      '{keeper} has to backpedal and tip the long-range effort over the bar.',
    ],
    failure: [
      'Struck well enough, but from that range it is a yard wide.',
      'Long range, and a long way over.',
    ],
    'critical-failure': ['{actor} tries their luck from forty yards and finds row Z.'],
  } },

  // Exclusive: mechanically a dribble, so the dribble pool would have this
  // failing like a turnover in midfield. Needs a complete set of its own.
  'round-keeper': {
    exclusive: true,
    lines: {
      'critical-success': [
        '{actor} sends {keeper} the wrong way completely and walks it into an empty net.',
        '{keeper} commits, {actor} does not even have to break stride, and it is rolled in.',
      ],
      success: [
        '{actor} takes it round {keeper} and rolls it into the empty net.',
        'A drop of the shoulder, {keeper} is beaten, and {actor} finishes into an open goal.',
        '{actor} goes past {keeper} and picks a spot with the goal gaping.',
      ],
      'partial-success': [
        '{actor} goes round {keeper}, but the angle is gone and the shot hits the side netting.',
        '{actor} beats {keeper} and rolls it goalwards — a defender hacks it off the line.',
        'Round {keeper} and past the post. {actor} took a fraction too long.',
      ],
      failure: [
        '{keeper} stays big and smothers it off the toe of {actor}.',
        '{actor} tries to go round {keeper} and the ball is poked away.',
        '{keeper} times it perfectly and dives in at the feet of {actor}.',
        'Too heavy from {actor}, and {keeper} does not have to move to collect it.',
      ],
      'critical-failure': [
        '{actor} takes one touch too many and {keeper} claims it comfortably.',
        '{actor} tries to be clever, gets it caught underfoot, and the chance evaporates.',
      ],
    },
  },

  // Exclusive: a square ball across the six-yard box is not a midfield pass.
  'pass-across-goal': {
    exclusive: true,
    lines: {
      'critical-success': [
        '{actor} rolls it across and it is turned in from a yard out. Unselfish and perfect.',
      ],
      success: [
        '{actor} squares it and there is a tap-in at the back post.',
        'Unselfish from {actor} — squared, and finished off from close range.',
        '{actor} picks out the runner and the finish is a formality.',
      ],
      'partial-success': [
        'The square ball is inches away from the sliding attacker at the back post.',
        '{actor} squares it and it is turned behind for a corner at full stretch.',
        'The pass is perfect but the runner cannot quite stretch to it.',
      ],
      failure: [
        '{actor} squares it, but {keeper} reads it and cuts it out.',
        '{opponent} gets across to intercept the square ball.',
        '{actor} rolls it too far in front of the runner.',
      ],
      'critical-failure': [
        'Nobody has gambled. {actor} rolls it across an empty six-yard box.',
        '{actor} squares it straight into {keeper}. There was a goal there for the taking.',
      ],
    },
  },
};

const POOLS: Record<OutcomeBand, Pool> = {
  'critical-success': CRITICAL_SUCCESS,
  success: SUCCESS,
  'partial-success': PARTIAL,
  failure: FAILURE,
  'critical-failure': CRITICAL_FAILURE,
};

function fill(template: string, names: CommentaryNames): string {
  return template
    .replace(/\{actor\}/g, names.actor)
    .replace(/\{opponent\}/g, names.opponent)
    .replace(/\{keeper\}/g, names.keeper);
}

/**
 * Every line eligible for an action in a band.
 *
 * Specific lines normally sit alongside the category pool rather than
 * replacing it — a handful of bespoke lines on their own would repeat far more
 * than the generic ones they displaced.
 */
export function linesFor(
  actionId: string,
  category: ActionCategory,
  band: OutcomeBand,
): string[] {
  const entry = ACTION_LINES[actionId];
  const specific = entry?.lines[band] ?? [];
  // An exclusive action still falls back if it is missing a band, so a gap
  // degrades to a slightly off line rather than a crash.
  if (entry?.exclusive && specific.length > 0) return specific;
  return [...specific, ...POOLS[band][category]];
}

/** Prefixes reserved for pulling off something that had no business working. */
const LONG_SHOT_PREFIXES = [
  'You will not see that again.',
  'Absolute nonsense — and it has come off.',
  'Nobody in the ground expected that.',
  'They will be talking about that one for years.',
];

export function describeOutcome(
  action: MatchAction,
  band: OutcomeBand,
  probability: number,
  names: CommentaryNames,
  rng: Rng,
): string {
  const line = fill(pick(rng, linesFor(action.id, action.category, band)), names);
  const succeeded = band === 'success' || band === 'critical-success';
  if (succeeded && probability <= 10) {
    return `${pick(rng, LONG_SHOT_PREFIXES)} ${line}`;
  }
  return line;
}

export function describeSituation(template: string, names: CommentaryNames): string {
  return fill(template, names);
}

const GOAL_CALLS = [
  'GOAL!',
  'IT IS IN!',
  'GOAL — and what a moment.',
  'THAT IS IN THE NET!',
];

export function goalCall(rng: Rng): string {
  return pick(rng, GOAL_CALLS);
}

const CONCEDED_CALLS = [
  'They have scored.',
  'It is in at the back post. Nothing you can do now.',
  'The net bulges. That is a goal against you.',
  'They finish it off. Heads up.',
];

export function concededCall(rng: Rng): string {
  return pick(rng, CONCEDED_CALLS);
}

const QUIET_PERIODS = [
  'A spell of nothing much. The ball is being passed around the middle third.',
  'Both sides feeling each other out. No real threat.',
  'Scrappy stuff — free kicks, throw-ins, and not a lot else.',
  'The game settles. Neither box is being troubled.',
  'A lull. The tempo has dropped right off.',
  'Plenty of possession, no penetration.',
];

export function quietPeriod(rng: Rng): string {
  return pick(rng, QUIET_PERIODS);
}
