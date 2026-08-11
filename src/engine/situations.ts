/**
 * Match situations.
 *
 * A situation is just data: a title, some narrative lines, how much pressure
 * the moment carries and who is likely to be involved. Adding a new one is a
 * new entry here plus actions that list it — no engine changes.
 */

import type { SituationDefinition, SituationId } from '../types';

export const SITUATIONS: Record<SituationId, SituationDefinition> = {
  'build-up': {
    id: 'build-up',
    side: 'attack',
    title: 'Build-up',
    pressure: 4,
    actorPositions: ['MID'],
    descriptions: [
      '{actor} picks the ball up in midfield with space to look up.',
      '{actor} takes it off the back four and turns into the middle third.',
      '{actor} has a touch in central midfield. {opponent} is closing.',
      'The ball comes inside to {actor}, twenty-five yards from halfway.',
    ],
  },
  'counter-attack': {
    id: 'counter-attack',
    side: 'attack',
    title: 'Counter attack',
    pressure: 3,
    actorPositions: ['MID', 'ATT'],
    descriptions: [
      '{actor} wins it back and the away end is already up — there are three ahead of the ball.',
      'Turnover. {actor} drives forward and the defence is stretched.',
      '{actor} intercepts and suddenly it is four against three.',
      'The clearance drops to {actor} with acres in front of them.',
    ],
  },
  'final-third': {
    id: 'final-third',
    side: 'attack',
    title: 'Final third',
    pressure: 6,
    actorPositions: ['ATT', 'MID'],
    descriptions: [
      '{actor} receives it on the edge of the box, back to goal.',
      '{actor} works a yard just outside the area with {opponent} tight behind.',
      'The move reaches {actor} twenty yards out. Bodies everywhere.',
      '{actor} holds it up on the corner of the box, waiting for support.',
    ],
  },
  'wing-attack': {
    id: 'wing-attack',
    side: 'attack',
    title: 'Wing attack',
    pressure: 5,
    actorPositions: ['ATT', 'MID', 'DEF'],
    descriptions: [
      '{actor} is away down the flank with {opponent} back-pedalling.',
      '{actor} takes it to the byline. Two runners attacking the six-yard box.',
      'It is worked wide to {actor}, one on one with the full-back.',
      '{actor} knocks it past {opponent} and gets to the touchline.',
    ],
  },
  'box-chance': {
    id: 'box-chance',
    side: 'attack',
    title: 'Chance in the box',
    pressure: 6,
    actorPositions: ['ATT'],
    descriptions: [
      'The ball hangs up at the far post and drops to {actor}.',
      '{actor} attacks it eight yards out with {opponent} leaning on them.',
      'It breaks in the six-yard box and {actor} is quickest to react.',
      '{actor} arrives on the penalty spot as the ball comes across.',
    ],
  },
  'one-on-one': {
    id: 'one-on-one',
    side: 'attack',
    title: 'One on one',
    pressure: 5,
    actorPositions: ['ATT'],
    descriptions: [
      '{actor} is through. Just the keeper to beat.',
      'The defence is opened up — {actor} runs clear with the goalkeeper advancing.',
      '{actor} is in behind, one on one, the whole ground on its feet.',
      'Nothing between {actor} and the goal but the keeper narrowing the angle.',
    ],
  },
  'opposition-counter': {
    id: 'opposition-counter',
    side: 'defence',
    title: 'Opposition counter',
    pressure: 4,
    actorPositions: ['DEF', 'MID'],
    descriptions: [
      'You lose it cheaply. {opponent} is driving at {actor} with runners either side.',
      '{opponent} breaks through the middle. {actor} is the last man back but not for long.',
      'The corner is cleared and they are away — {actor} has to slow it down.',
      '{opponent} carries it over halfway. Your shape is stretched.',
    ],
  },
  'defend-through-ball': {
    id: 'defend-through-ball',
    side: 'defence',
    title: 'Defending a through ball',
    pressure: 5,
    actorPositions: ['DEF'],
    descriptions: [
      '{opponent} lifts their head to slide it in behind {actor}.',
      'The striker is spinning off {actor}’s shoulder and the pass is on.',
      '{actor} sees the ball coming through the channel.',
      'They work the overload — the pass in behind {actor} is loaded up.',
    ],
  },
  'defend-cross': {
    id: 'defend-cross',
    side: 'defence',
    title: 'Defending a cross',
    pressure: 5,
    actorPositions: ['DEF'],
    descriptions: [
      'The winger stands it up to the back post where {actor} is marking.',
      'It is whipped in low and hard across the six-yard box. {actor} has to react.',
      '{opponent} gets to the byline and looks up. {actor} is on the striker.',
      'The cross is coming. {actor} is the one who has to deal with it.',
    ],
  },
  'defend-one-on-one': {
    id: 'defend-one-on-one',
    side: 'defence',
    title: 'Last man',
    pressure: 7,
    actorPositions: ['DEF'],
    descriptions: [
      '{opponent} is through the middle with only {actor} in the way.',
      '{actor} is the last defender and {opponent} is running at them with pace.',
      'It is one against one on the edge of your area. {actor} has to decide.',
      'A bad touch is all that has saved you — {actor} faces {opponent} in the box.',
    ],
  },
};

export const ATTACKING_SITUATIONS: SituationId[] = [
  'build-up',
  'counter-attack',
  'final-third',
  'wing-attack',
];

export const DEFENSIVE_SITUATIONS: SituationId[] = [
  'opposition-counter',
  'defend-through-ball',
  'defend-cross',
];

/**
 * Where a defensive failure leaves you. The end of the chain is a goal, which
 * is what makes the safe-but-passive defensive options a real decision.
 */
export const DEFENSIVE_ESCALATION: Partial<Record<SituationId, SituationId | 'concede'>> = {
  'opposition-counter': 'defend-through-ball',
  'defend-through-ball': 'defend-one-on-one',
  'defend-cross': 'concede',
  'defend-one-on-one': 'concede',
};

export function getSituation(id: SituationId): SituationDefinition {
  return SITUATIONS[id];
}
