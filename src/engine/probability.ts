/**
 * The probability engine.
 *
 * Every number the player sees comes from here, and every number comes with a
 * label explaining where it came from. A probability the manager cannot
 * interrogate is a probability they will not trust.
 */

import type {
  AttributeKey,
  ClubRatings,
  MatchAction,
  Player,
  ProbabilityBreakdown,
  ProbabilityFactor,
  SituationDefinition,
  Tactics,
} from '../types';

/**
 * Hard limits. Nothing is ever certain and nothing is ever impossible — the
 * whole game rests on that, so the clamp lives with the engine rather than
 * being applied ad hoc at call sites.
 */
export const MIN_PROBABILITY = 1;
export const MAX_PROBABILITY = 99;

export function clampProbability(value: number): number {
  return Math.min(MAX_PROBABILITY, Math.max(MIN_PROBABILITY, Math.round(value)));
}

export interface ActionContext {
  /** The player attempting the action. */
  actor: Player;
  /** Ratings of the team resisting it. */
  opposition: ClubRatings;
  tactics: Tactics;
  situation: SituationDefinition;
  isHome: boolean;
  minute: number;
  /**
   * A modifier carried over from the previous decision in the same passage of
   * play — see `MatchState.carriedAdvantage`. Listed like any other factor,
   * because a bonus the player cannot see is exactly the kind of hidden hand
   * this game exists to avoid.
   */
  carriedAdvantage?: ProbabilityFactor | null;
}

const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  pace: 'Pace',
  shooting: 'Shooting',
  passing: 'Passing',
  vision: 'Vision',
  technique: 'Technique',
  strength: 'Strength',
  defending: 'Defending',
  positioning: 'Positioning',
  composure: 'Composure',
  stamina: 'Stamina',
  flair: 'Flair',
  reflexes: 'Reflexes',
  handling: 'Handling',
  distribution: 'Distribution',
  oneOnOnes: 'One-on-ones',
};

const OPPOSITION_LABELS: Record<keyof ClubRatings, string> = {
  attack: 'Opposition attack',
  midfield: 'Opposition midfield',
  defence: 'Opposition defence',
  goalkeeper: 'Opposition goalkeeper',
  overall: 'Opposition quality',
};

/** Average rating: the point at which an attribute is worth nothing either way. */
const NEUTRAL_RATING = 50;

/**
 * Weights are expressed as "percentage points per 10 rating points above
 * average", which keeps the numbers on the breakdown panel readable.
 */
function ratingContribution(rating: number, weight: number): number {
  return Math.round(((rating - NEUTRAL_RATING) / 10) * weight);
}

function tacticalFactors(action: MatchAction, tactics: Tactics): ProbabilityFactor[] {
  const factors: ProbabilityFactor[] = [];

  if (action.suits) {
    let matches = 0;
    if (action.suits.mentality && action.suits.mentality === tactics.mentality) matches++;
    if (action.suits.passing && action.suits.passing === tactics.passing) matches++;
    if (action.suits.tempo && action.suits.tempo === tactics.tempo) matches++;
    if (action.suits.pressing && action.suits.pressing === tactics.pressing) matches++;
    if (matches > 0) {
      factors.push({ label: 'Suits your tactics', value: matches * 4 });
    }
  }

  // Mentality nudges risk-taking in the obvious direction.
  const aggression: Record<Tactics['mentality'], number> = {
    defensive: -1,
    balanced: 0,
    attacking: 1,
    'very-attacking': 2,
  };
  const lean = aggression[tactics.mentality];
  if (lean !== 0) {
    const risky = action.riskLevel === 'risky' || action.riskLevel === 'extreme';
    const value = risky ? lean * 2 : -lean;
    if (value !== 0) {
      factors.push({ label: `${mentalityLabel(tactics.mentality)} mentality`, value });
    }
  }

  // A fast tempo rushes technical work; a slow one buys a moment of thought.
  if (tactics.tempo === 'fast' && action.category !== 'defend') {
    factors.push({ label: 'Fast tempo', value: -2 });
  } else if (tactics.tempo === 'slow' && action.category !== 'defend') {
    factors.push({ label: 'Slow tempo', value: 2 });
  }

  // Pressing wins the ball higher but leaves defenders isolated.
  if (action.category === 'defend') {
    if (tactics.pressing === 'high') factors.push({ label: 'High press', value: 3 });
    if (tactics.pressing === 'low') factors.push({ label: 'Low block', value: -2 });
  }

  return factors.filter((f) => f.value !== 0);
}

function mentalityLabel(mentality: Tactics['mentality']): string {
  switch (mentality) {
    case 'defensive':
      return 'Defensive';
    case 'balanced':
      return 'Balanced';
    case 'attacking':
      return 'Attacking';
    case 'very-attacking':
      return 'Very attacking';
  }
}

/**
 * Builds the full, itemised probability for an action in a context.
 *
 * The returned breakdown is what the "WHY?" panel renders, so base + every
 * factor must add up to `raw` exactly — the numbers on screen have to survive
 * being added up by a suspicious player.
 */
export function calculateProbability(
  action: MatchAction,
  context: ActionContext,
): ProbabilityBreakdown {
  const { actor, opposition, tactics, situation, isHome, minute, carriedAdvantage } =
    context;
  const factors: ProbabilityFactor[] = [];

  if (carriedAdvantage) factors.push({ ...carriedAdvantage });

  for (const [key, weight] of Object.entries(action.attributeWeights)) {
    if (!weight) continue;
    const attribute = key as AttributeKey;
    const rating = actor.attributes[attribute];
    const value = ratingContribution(rating, weight);
    if (value !== 0) factors.push({ label: ATTRIBUTE_LABELS[attribute], value });
  }

  for (const [key, weight] of Object.entries(action.opposedBy)) {
    if (!weight) continue;
    const ratingKey = key as keyof ClubRatings;
    const value = -ratingContribution(opposition[ratingKey], weight);
    if (value !== 0) factors.push({ label: OPPOSITION_LABELS[ratingKey], value });
  }

  if (situation.pressure !== 0) {
    factors.push({ label: 'Pressure on the ball', value: -situation.pressure });
  }

  factors.push(...tacticalFactors(action, tactics));

  const fatigue = -Math.round((100 - actor.fitness) / 8);
  if (fatigue !== 0) factors.push({ label: 'Fatigue', value: fatigue });

  factors.push(
    isHome
      ? { label: 'Home advantage', value: 3 }
      : { label: 'Away from home', value: -2 },
  );

  // The closing stages get inside a player's head, and only on the hard stuff.
  if (minute >= 80 && (action.riskLevel === 'risky' || action.riskLevel === 'extreme')) {
    const composure = ratingContribution(actor.attributes.composure, 1);
    factors.push({ label: 'Nerves (late on)', value: -3 + Math.max(0, composure) });
  }

  const meaningful = factors.filter((factor) => factor.value !== 0);
  const raw =
    action.baseProbability + meaningful.reduce((sum, factor) => sum + factor.value, 0);
  const final = clampProbability(raw);

  return {
    base: action.baseProbability,
    factors: meaningful,
    raw,
    final,
    clamped: final !== Math.round(raw),
  };
}
