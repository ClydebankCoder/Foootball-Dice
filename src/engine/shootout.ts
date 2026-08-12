/**
 * The penalty shootout.
 *
 * Every kick is a visible probability and a D100, taken or faced by the
 * manager — there is no passage of play to abstract away, so this is the
 * densest run of the core mechanic in the game: a dozen locked-in numbers in
 * a row with a cup on the end of it.
 *
 * Facing a kick is informed rather than a coin flip. The keeper is given a
 * read on the taker, and the diving options price it in: going the way the
 * read points is worth roughly double, and the fact that a read can be a
 * bluff is already inside that number rather than hidden behind it.
 */

import { getClubWithSquad } from '../data/world';
import type {
  OutcomeBand,
  PenaltyDirection,
  Player,
  ProbabilityBreakdown,
  ProbabilityFactor,
  ShootoutKick,
  ShootoutRole,
  ShootoutState,
} from '../types';
import { clampProbability } from './probability';
import { bandForRoll } from './resolve';
import { createSeededRng, pick, randomSeed, rollD100, type Rng } from './random';

/** Kicks each before sudden death. */
export const REGULATION_KICKS = 5;

export interface PenaltyAction {
  id: string;
  name: string;
  blurb: string;
  role: ShootoutRole;
  baseProbability: number;
  attributeWeights: Partial<Record<keyof Player['attributes'], number>>;
  /** How much the opposing goalkeeper's quality resists it. */
  opposedByKeeper: number;
  /** For diving options: the corner being covered. */
  direction?: PenaltyDirection;
}

export const PENALTY_ACTIONS: PenaltyAction[] = [
  {
    id: 'side-foot',
    name: 'Side-Foot It',
    blurb: 'Pick a corner and pass it in. No power, all placement.',
    role: 'taking',
    baseProbability: 70,
    attributeWeights: { composure: 2, technique: 2 },
    opposedByKeeper: 2,
  },
  {
    id: 'power',
    name: 'Power',
    blurb: 'Through it. Give the keeper no time to react.',
    role: 'taking',
    baseProbability: 66,
    attributeWeights: { shooting: 3, strength: 1 },
    opposedByKeeper: 1,
  },
  {
    id: 'down-the-middle',
    name: 'Down The Middle',
    blurb: 'Stand still and trust them to dive. Nerve required.',
    role: 'taking',
    baseProbability: 62,
    attributeWeights: { composure: 3 },
    opposedByKeeper: 1,
  },
  {
    id: 'stutter',
    name: 'Stutter Run-Up',
    blurb: 'Wait for them to commit, then roll it the other way.',
    role: 'taking',
    baseProbability: 52,
    attributeWeights: { composure: 3, flair: 1 },
    opposedByKeeper: 2,
  },
  {
    id: 'top-corner',
    name: 'Top Corner',
    blurb: 'Unsaveable if it lands. A yard high and you are a meme.',
    role: 'taking',
    baseProbability: 38,
    attributeWeights: { technique: 3, shooting: 2, composure: 1 },
    opposedByKeeper: 1,
  },
  {
    id: 'panenka',
    name: 'Panenka',
    blurb: 'Scoop it down the middle. Immortality or infamy.',
    role: 'taking',
    baseProbability: 12,
    attributeWeights: { flair: 3, composure: 3 },
    opposedByKeeper: 1,
  },

  {
    id: 'dive-left',
    name: 'Dive Left',
    blurb: 'Commit early to the left corner.',
    role: 'saving',
    baseProbability: 14,
    attributeWeights: { reflexes: 2, oneOnOnes: 1 },
    opposedByKeeper: 0,
    direction: 'left',
  },
  {
    id: 'stay-central',
    name: 'Stand Tall',
    blurb: 'Hold your ground and cover the middle.',
    role: 'saving',
    baseProbability: 12,
    attributeWeights: { positioning: 2, composure: 1 },
    opposedByKeeper: 0,
    direction: 'centre',
  },
  {
    id: 'dive-right',
    name: 'Dive Right',
    blurb: 'Commit early to the right corner.',
    role: 'saving',
    baseProbability: 14,
    attributeWeights: { reflexes: 2, oneOnOnes: 1 },
    opposedByKeeper: 0,
    direction: 'right',
  },
];

export function getPenaltyAction(id: string): PenaltyAction {
  const action = PENALTY_ACTIONS.find((a) => a.id === id);
  if (!action) throw new Error(`Unknown penalty action: ${id}`);
  return action;
}

/** Reading the taker correctly is worth this much to a diving keeper. */
const CORRECT_READ_BONUS = 22;
const WRONG_READ_PENALTY = 6;
/** The weight of a shootout gets heavier the longer it runs. */
const SUDDEN_DEATH_PRESSURE = 4;

function keeperRating(keeper: Player): number {
  const a = keeper.attributes;
  return Math.round((a.reflexes + a.oneOnOnes + a.handling + a.positioning) / 4);
}

function contribution(rating: number, weight: number): number {
  return Math.round(((rating - 50) / 10) * weight);
}

const ATTRIBUTE_LABELS: Partial<Record<keyof Player['attributes'], string>> = {
  composure: 'Composure',
  technique: 'Technique',
  shooting: 'Shooting',
  strength: 'Strength',
  flair: 'Flair',
  reflexes: 'Reflexes',
  oneOnOnes: 'One-on-ones',
  positioning: 'Positioning',
};

/**
 * The probability for one penalty option, itemised the same way every other
 * decision in the game is.
 */
export function penaltyProbability(
  action: PenaltyAction,
  actor: Player,
  opposingKeeper: Player,
  state: ShootoutState,
): ProbabilityBreakdown {
  const factors: ProbabilityFactor[] = [];

  for (const [key, weight] of Object.entries(action.attributeWeights)) {
    if (!weight) continue;
    const attribute = key as keyof Player['attributes'];
    const value = contribution(actor.attributes[attribute], weight);
    if (value !== 0) {
      factors.push({ label: ATTRIBUTE_LABELS[attribute] ?? attribute, value });
    }
  }

  if (action.role === 'taking' && action.opposedByKeeper > 0) {
    const value = -contribution(keeperRating(opposingKeeper), action.opposedByKeeper);
    if (value !== 0) factors.push({ label: 'Opposition goalkeeper', value });
  }

  if (action.role === 'saving' && state.tell) {
    factors.push(
      action.direction === state.tell.direction
        ? { label: 'You have read the run-up', value: CORRECT_READ_BONUS }
        : { label: 'Against the read', value: -WRONG_READ_PENALTY },
    );
  }

  // A kick that can lose the shootout is a different kick.
  if (state.suddenDeath) {
    factors.push({
      label: 'Sudden death',
      value: action.role === 'taking' ? -SUDDEN_DEATH_PRESSURE : SUDDEN_DEATH_PRESSURE,
    });
  }

  const meaningful = factors.filter((f) => f.value !== 0);
  const raw = action.baseProbability + meaningful.reduce((t, f) => t + f.value, 0);
  const final = clampProbability(raw);

  return { base: action.baseProbability, factors: meaningful, raw, final, clamped: final !== Math.round(raw) };
}

/* ------------------------------------------------------------ rng plumbing */

function draws(state: ShootoutState) {
  const base = createSeededRng(state.seed);
  for (let i = 0; i < state.rngCursor; i++) base.next();
  let used = 0;
  return {
    rng: { next: () => (used++, base.next()) } as Rng,
    used: () => used,
  };
}

/* --------------------------------------------------------------- the tell */

const TELLS: Record<PenaltyDirection, string[]> = {
  left: [
    'They have glanced at the left corner twice on the way to the spot.',
    'Their standing foot is opening up towards the left.',
    'Everything about the run-up says left.',
  ],
  centre: [
    'They are not looking at the corners at all. This could be straight down the middle.',
    'A long, slow run-up. They are waiting for you to move.',
    'Eyes fixed on the ball. No clue either way — but they have gone middle before.',
  ],
  right: [
    'They keep checking the right-hand post.',
    'The angle of the approach points right.',
    'Body shape suggests they are going to their right.',
  ],
};

function makeTell(rng: Rng): { direction: PenaltyDirection; text: string } {
  const direction = pick(rng, ['left', 'centre', 'right'] as PenaltyDirection[]);
  return { direction, text: pick(rng, TELLS[direction]) };
}

/* ------------------------------------------------------------- commentary */

const SCORED = [
  '{player} sends the keeper the wrong way. Nets it.',
  'Emphatic. {player} gives the keeper no chance.',
  '{player} buries it. No hesitation.',
  'Right in the corner. {player} makes it look routine.',
];

const MISSED = [
  '{player} strikes it too close to the keeper. Saved!',
  'Over the bar. {player} cannot watch.',
  'Wide of the post. {player} has missed it.',
  'The keeper guesses right and pushes it away from {player}.',
];

const SAVED_BY_YOU = [
  'SAVED! {player} guesses right and keeps it out.',
  '{player} flies across and gets a strong hand to it.',
  'Brilliant. {player} reads it perfectly and turns it away.',
];

const BEATEN = [
  '{player} goes the right way but cannot reach it.',
  'No chance for {player} — that was in off the post.',
  '{player} commits early and it goes the other side.',
];

/* ------------------------------------------------------------ the shootout */

export function createShootout(
  homeClubId: string,
  awayClubId: string,
  userClubId: string,
  seed = randomSeed(),
): ShootoutState {
  const state: ShootoutState = {
    homeClubId,
    awayClubId,
    userClubId,
    homeScore: 0,
    awayScore: 0,
    kicks: [],
    turnClubId: homeClubId,
    kickNumber: 1,
    suddenDeath: false,
    complete: false,
    winnerClubId: null,
    tell: null,
    seed,
    rngCursor: 0,
  };
  return refreshTell(state);
}

/** Whether the manager is taking this kick or facing it. */
export function roleFor(state: ShootoutState): ShootoutRole {
  return state.turnClubId === state.userClubId ? 'taking' : 'saving';
}

function oppositionOf(state: ShootoutState): string {
  return state.userClubId === state.homeClubId ? state.awayClubId : state.homeClubId;
}

/** The player stepping up, or the manager's keeper when facing one. */
export function actorFor(state: ShootoutState): Player {
  const role = roleFor(state);
  if (role === 'taking') {
    const squad = getClubWithSquad(state.userClubId);
    const takers = squad.players
      .filter((p) => p.position !== 'GK')
      .sort((a, b) => b.attributes.composure - a.attributes.composure);
    // Work down the list of takers as the shootout goes on.
    return takers[Math.min(state.kicks.length, takers.length - 1)];
  }
  return goalkeeperOf(state.userClubId);
}

export function goalkeeperOf(clubId: string): Player {
  const squad = getClubWithSquad(clubId);
  return (
    squad.players
      .filter((p) => p.position === 'GK')
      .sort((a, b) => b.overall - a.overall)[0] ?? squad.players[0]
  );
}

/** The opposition player involved in this kick. */
export function opponentFor(state: ShootoutState): Player {
  const opposition = oppositionOf(state);
  if (roleFor(state) === 'taking') return goalkeeperOf(opposition);
  const squad = getClubWithSquad(opposition);
  const takers = squad.players
    .filter((p) => p.position !== 'GK')
    .sort((a, b) => b.attributes.composure - a.attributes.composure);
  return takers[Math.min(state.kicks.length, takers.length - 1)];
}

export interface PenaltyOption {
  action: PenaltyAction;
  breakdown: ProbabilityBreakdown;
  probability: number;
}

/**
 * Every option for the kick in front of the manager.
 *
 * When taking, the number is the chance of scoring. When facing one, it is the
 * chance of saving it.
 */
export function penaltyOptions(state: ShootoutState): PenaltyOption[] {
  const role = roleFor(state);
  const actor = actorFor(state);
  const opponent = opponentFor(state);

  const options = PENALTY_ACTIONS.filter((action) => action.role === role).map(
    (action) => {
      const breakdown = penaltyProbability(action, actor, opponent, state);
      return { action, breakdown, probability: breakdown.final };
    },
  );

  // Taking options sort best-first like every other menu in the game. Diving
  // options keep their left-centre-right order, because they describe a
  // goalmouth and shuffling them would break that mapping.
  return role === 'taking'
    ? options.sort((a, b) => b.probability - a.probability)
    : options;
}

function kicksBy(state: ShootoutState, clubId: string): number {
  return state.kicks.filter((kick) => kick.clubId === clubId).length;
}

function refreshTell(state: ShootoutState): ShootoutState {
  if (roleFor(state) !== 'saving') return { ...state, tell: null };
  const { rng, used } = draws(state);
  const tell = makeTell(rng);
  return { ...state, tell, rngCursor: state.rngCursor + used() };
}

/**
 * Decides whether the shootout is over, and who won.
 *
 * Uses the real rule rather than always playing ten kicks: it stops the moment
 * one side cannot be caught.
 */
function settle(state: ShootoutState): ShootoutState {
  const homeTaken = kicksBy(state, state.homeClubId);
  const awayTaken = kicksBy(state, state.awayClubId);

  if (!state.suddenDeath) {
    const homeLeft = Math.max(0, REGULATION_KICKS - homeTaken);
    const awayLeft = Math.max(0, REGULATION_KICKS - awayTaken);

    if (state.homeScore > state.awayScore + awayLeft) {
      return { ...state, complete: true, winnerClubId: state.homeClubId };
    }
    if (state.awayScore > state.homeScore + homeLeft) {
      return { ...state, complete: true, winnerClubId: state.awayClubId };
    }
    if (homeTaken >= REGULATION_KICKS && awayTaken >= REGULATION_KICKS) {
      if (state.homeScore !== state.awayScore) {
        return {
          ...state,
          complete: true,
          winnerClubId:
            state.homeScore > state.awayScore ? state.homeClubId : state.awayClubId,
        };
      }
      return { ...state, suddenDeath: true };
    }
    return state;
  }

  // Sudden death: decided only once both have taken the same number of kicks.
  if (homeTaken === awayTaken && state.homeScore !== state.awayScore) {
    return {
      ...state,
      complete: true,
      winnerClubId:
        state.homeScore > state.awayScore ? state.homeClubId : state.awayClubId,
    };
  }
  return state;
}

export interface PenaltyResult {
  state: ShootoutState;
  kick: ShootoutKick;
  probability: number;
  roll: number;
  band: OutcomeBand;
  /** True when the manager's chosen outcome came off. */
  success: boolean;
}

/**
 * Resolves the kick in front of the manager.
 *
 * `roll` can be injected to replay or test a specific number, exactly as in
 * open play.
 */
export function takePenalty(
  state: ShootoutState,
  actionId: string,
  options: { roll?: number } = {},
): PenaltyResult {
  if (state.complete) throw new Error('The shootout is already over.');

  const action = getPenaltyAction(actionId);
  const role = roleFor(state);
  if (action.role !== role) {
    throw new Error(`Cannot use a ${action.role} option while ${role}.`);
  }

  const { rng, used } = draws(state);
  const actor = actorFor(state);
  const opponent = opponentFor(state);
  const breakdown = penaltyProbability(action, actor, opponent, state);
  const probability = breakdown.final;

  const roll = options.roll ?? rollD100(rng);
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) {
    throw new Error(`A D100 roll must be an integer from 1 to 100, got ${roll}`);
  }
  const success = roll <= probability;
  const band = bandForRoll(probability, roll);

  // Taking: success is a goal. Saving: success is a save, so the kick is
  // scored only when the manager fails to keep it out.
  const scored = role === 'taking' ? success : !success;
  const scoringClub = state.turnClubId;

  const template =
    role === 'taking'
      ? pick(rng, scored ? SCORED : MISSED)
      : pick(rng, scored ? BEATEN : SAVED_BY_YOU);
  const namedPlayer = role === 'taking' ? actor : success ? actor : opponent;

  const kick: ShootoutKick = {
    clubId: scoringClub,
    playerName: (role === 'taking' ? actor : opponent).name,
    role,
    actionName: action.name,
    probability,
    roll,
    scored,
    commentary: template.replace(/\{player\}/g, namedPlayer.name),
    userDecision: true,
  };

  let next: ShootoutState = {
    ...state,
    kicks: [...state.kicks, kick],
    homeScore: state.homeScore + (scored && scoringClub === state.homeClubId ? 1 : 0),
    awayScore: state.awayScore + (scored && scoringClub === state.awayClubId ? 1 : 0),
    rngCursor: state.rngCursor + used(),
  };

  next = settle(next);

  if (!next.complete) {
    const nextTurn =
      state.turnClubId === state.homeClubId ? state.awayClubId : state.homeClubId;
    next = {
      ...next,
      turnClubId: nextTurn,
      kickNumber:
        nextTurn === next.homeClubId ? next.kickNumber + 1 : next.kickNumber,
    };
    next = refreshTell(next);
  } else {
    next = { ...next, tell: null };
  }

  return { state: next, kick, probability, roll, band, success };
}

/** Score line as it would appear on a scoreboard. */
export function shootoutScore(state: ShootoutState): string {
  return `${state.homeScore}–${state.awayScore}`;
}
