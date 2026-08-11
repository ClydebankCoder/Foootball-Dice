/**
 * Squad generation.
 *
 * Squads are generated deterministically from the club id, so the same club
 * always fields the same players without a hand-written roster per team. When
 * real player data arrives it can replace `buildSquad` wholesale — everything
 * downstream only consumes `Player[]`.
 */

import { calculateOverall } from '../engine/ratings';
import { createSeededRng, randomInt, shuffle, type Rng } from '../engine/random';
import type { Attributes, Club, Player, Position } from '../types';
import { FIRST_NAMES, SURNAMES } from './names';

/** Squad shape: 18 players, enough to feel like a club without being a chore. */
const SQUAD_SHAPE: Position[] = [
  'GK', 'GK',
  'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF',
  'MID', 'MID', 'MID', 'MID', 'MID', 'MID',
  'ATT', 'ATT', 'ATT', 'ATT',
];

/**
 * Offsets from a player's quality level, per position. A centre-forward's
 * shooting sits above their general level; their defending sits well below.
 */
const ATTRIBUTE_SHAPES: Record<Position, Partial<Record<keyof Attributes, number>>> = {
  GK: {
    reflexes: 6, handling: 4, positioning: 3, oneOnOnes: 2, distribution: -2,
    composure: 2, pace: -25, shooting: -45, passing: -18, vision: -16,
    technique: -14, strength: 0, defending: -30, stamina: -8, flair: -20,
  },
  DEF: {
    defending: 8, positioning: 6, strength: 5, pace: 0, composure: 0,
    passing: -6, vision: -10, technique: -8, shooting: -25, stamina: 2,
    flair: -14, reflexes: -40, handling: -40, distribution: -30, oneOnOnes: -40,
  },
  MID: {
    passing: 7, vision: 6, technique: 5, stamina: 6, composure: 2,
    positioning: 0, defending: -2, strength: -3, pace: -1, shooting: -8,
    flair: 0, reflexes: -40, handling: -40, distribution: -30, oneOnOnes: -40,
  },
  ATT: {
    shooting: 8, pace: 6, technique: 4, flair: 5, composure: 3,
    positioning: 2, strength: 0, passing: -8, vision: -6, stamina: -2,
    defending: -28, reflexes: -40, handling: -40, distribution: -30, oneOnOnes: -40,
  },
};

const ALL_KEYS: (keyof Attributes)[] = [
  'pace', 'shooting', 'passing', 'vision', 'technique', 'strength',
  'defending', 'positioning', 'composure', 'stamina', 'flair',
  'reflexes', 'handling', 'distribution', 'oneOnOnes',
];

function clampRating(value: number): number {
  return Math.min(99, Math.max(5, Math.round(value)));
}

/** Stable 32-bit hash so a club id always yields the same squad. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function qualityFor(club: Club, position: Position, index: number, rng: Rng): number {
  const base =
    position === 'GK'
      ? club.profile.goalkeeper
      : position === 'DEF'
        ? club.profile.defence
        : position === 'MID'
          ? club.profile.midfield
          : club.profile.attack;

  // First-choice players sit around the club's level; squad players below it.
  const depthPenalty = index === 0 ? 2 : index <= 2 ? 0 : -6 - index;
  return base + depthPenalty + randomInt(rng, -5, 5);
}

function buildAttributes(position: Position, quality: number, rng: Rng): Attributes {
  const shape = ATTRIBUTE_SHAPES[position];
  const attributes = {} as Attributes;
  for (const key of ALL_KEYS) {
    const offset = shape[key] ?? 0;
    attributes[key] = clampRating(quality + offset + randomInt(rng, -6, 6));
  }
  return attributes;
}

export function buildSquad(club: Club): Player[] {
  const rng = createSeededRng(hashString(club.id));
  const firstNames = shuffle(rng, FIRST_NAMES);
  const surnames = shuffle(rng, SURNAMES);

  const counters: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };

  return SQUAD_SHAPE.map((position, i) => {
    const index = counters[position]++;
    const quality = qualityFor(club, position, index, rng);
    const attributes = buildAttributes(position, quality, rng);
    const name = `${firstNames[i % firstNames.length]} ${surnames[i % surnames.length]}`;

    return {
      id: `${club.id}-p${i + 1}`,
      clubId: club.id,
      name,
      age: randomInt(rng, 17, 35),
      position,
      squadNumber: i + 1,
      attributes,
      overall: calculateOverall(position, attributes),
      fitness: randomInt(rng, 88, 100),
    } satisfies Player;
  });
}
