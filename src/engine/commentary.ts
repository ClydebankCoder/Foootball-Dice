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
  shot: [
    '{keeper} gets down low and pushes it away for a corner.',
    'Off the post and back into play. {actor} cannot believe it.',
    '{actor} tests {keeper}, who parries and gathers at the second attempt.',
    'Deflected wide by a desperate block. Corner.',
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
  shot: [
    '{actor} drags it wide of the far post.',
    'Over the bar. {actor} leaned back on that one.',
    '{keeper} makes it look easy — straight at them.',
    '{actor} slices it and the ball drifts harmlessly out.',
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
  const line = fill(pick(rng, POOLS[band][action.category]), names);
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
