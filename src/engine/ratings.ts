/**
 * Derived ratings.
 *
 * Team ratings come from the players rather than being typed in, so improving
 * a squad improves the numbers the probability engine reads. They are inputs
 * to probabilities, never a shortcut to a result — a weaker side still only
 * needs the dice to fall its way.
 */

import type { Attributes, ClubRatings, Player, Position } from '../types';

type Weights = Partial<Record<keyof Attributes, number>>;

const OVERALL_WEIGHTS: Record<Position, Weights> = {
  GK: {
    reflexes: 0.3,
    handling: 0.25,
    positioning: 0.2,
    oneOnOnes: 0.15,
    distribution: 0.05,
    composure: 0.05,
  },
  DEF: {
    defending: 0.3,
    positioning: 0.24,
    strength: 0.15,
    pace: 0.12,
    composure: 0.11,
    passing: 0.08,
  },
  MID: {
    passing: 0.25,
    vision: 0.2,
    technique: 0.17,
    defending: 0.1,
    stamina: 0.1,
    positioning: 0.1,
    composure: 0.08,
  },
  ATT: {
    shooting: 0.3,
    pace: 0.2,
    technique: 0.18,
    composure: 0.15,
    positioning: 0.1,
    flair: 0.07,
  },
};

export function calculateOverall(position: Position, attributes: Attributes): number {
  const weights = OVERALL_WEIGHTS[position];
  let total = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (!weight) continue;
    total += attributes[key as keyof Attributes] * weight;
    weightSum += weight;
  }
  return Math.round(total / weightSum);
}

function bestOf(players: Player[], position: Position, count: number): number {
  const pool = players
    .filter((p) => p.position === position)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, count);
  if (pool.length === 0) return 50;
  return Math.round(pool.reduce((sum, p) => sum + p.overall, 0) / pool.length);
}

export function deriveClubRatings(players: Player[]): ClubRatings {
  const goalkeeper = bestOf(players, 'GK', 1);
  const defence = bestOf(players, 'DEF', 4);
  const midfield = bestOf(players, 'MID', 4);
  const attack = bestOf(players, 'ATT', 3);
  const overall = Math.round(
    attack * 0.3 + midfield * 0.3 + defence * 0.3 + goalkeeper * 0.1,
  );
  return { attack, midfield, defence, goalkeeper, overall };
}
