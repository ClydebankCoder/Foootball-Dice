/**
 * The Scottish Cup.
 *
 * Staggered entry, like the real thing: the two lowest divisions play a
 * preliminary round, and the ten survivors join the Premiership and
 * Championship for a Round of 32. That gives clean maths — 42 clubs down to
 * 32, 16, 8, 4, 2 — and it means taking a lower-league job buys you an extra
 * tie and a longer road, which is the whole point of picking one.
 *
 * The draw is open and unseeded, so a League Two side can get Celtic away in
 * the first round they play. That is not a flaw in the format; it is the
 * reason to build a cup for a game about improbable things happening.
 */

import type { LeagueId } from '../types';

export interface CupRound {
  index: number;
  name: string;
  shortName: string;
  /** Divisions joining the competition at this round. */
  entrants: LeagueId[];
}

export const CUP_ROUNDS: CupRound[] = [
  {
    index: 0,
    name: 'Preliminary Round',
    shortName: 'Prelim',
    entrants: ['league-one', 'league-two'],
  },
  {
    index: 1,
    name: 'Round of 32',
    shortName: 'R32',
    entrants: ['premiership', 'championship'],
  },
  { index: 2, name: 'Round of 16', shortName: 'R16', entrants: [] },
  { index: 3, name: 'Quarter-Final', shortName: 'QF', entrants: [] },
  { index: 4, name: 'Semi-Final', shortName: 'SF', entrants: [] },
  { index: 5, name: 'Final', shortName: 'Final', entrants: [] },
];

export const FINAL_ROUND = CUP_ROUNDS.length - 1;

export function getCupRound(index: number): CupRound {
  const round = CUP_ROUNDS[index];
  if (!round) throw new Error(`Unknown cup round: ${index}`);
  return round;
}

/** Neutral venue for the showpiece. */
export const FINAL_VENUE = 'Hampden Park';
