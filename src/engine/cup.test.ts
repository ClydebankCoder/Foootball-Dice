import { describe, expect, it } from 'vitest';
import { startingDivisions } from '../data/clubs';
import { CUP_ROUNDS, FINAL_ROUND } from '../data/cup';
import {
  advanceRound,
  createCup,
  drawRound,
  roundComplete,
  simulateRestOfRound,
  tieFor,
  tiesInRound,
} from './cup';
import { createSeededRng } from './random';
import type { CupState } from '../types';

const divisions = startingDivisions();

/** Runs a whole cup through to a winner. */
function playWholeCup(seed: number): CupState {
  const rng = createSeededRng(seed);
  let cup = createCup(1, divisions, rng);

  for (let guard = 0; guard < 20; guard++) {
    cup = simulateRestOfRound(cup, rng);
    expect(roundComplete(cup)).toBe(true);
    if (cup.round >= FINAL_ROUND) {
      cup = advanceRound(cup, divisions, rng);
      break;
    }
    cup = advanceRound(cup, divisions, rng);
  }
  return cup;
}

describe('the cup bracket', () => {
  it('starts with the two lowest divisions in a preliminary round', () => {
    const rng = createSeededRng(1);
    const cup = createCup(1, divisions, rng);
    const prelim = tiesInRound(cup, 0);

    expect(prelim).toHaveLength(10);
    const clubs = prelim.flatMap((t) => [t.homeClubId, t.awayClubId]);
    expect(clubs).toHaveLength(20);
    // Only League One and League Two clubs are in the hat.
    const eligible = [...divisions['league-one'], ...divisions['league-two']];
    for (const clubId of clubs) expect(eligible).toContain(clubId);
  });

  it('puts 32 clubs into the second round', () => {
    const rng = createSeededRng(2);
    let cup = createCup(1, divisions, rng);
    cup = advanceRound(simulateRestOfRound(cup, rng), divisions, rng);

    const round = tiesInRound(cup, 1);
    expect(round).toHaveLength(16);
    const clubs = round.flatMap((t) => [t.homeClubId, t.awayClubId]);
    expect(new Set(clubs).size).toBe(32);
  });

  it('halves the field every round down to a final', () => {
    const rng = createSeededRng(3);
    let cup = createCup(1, divisions, rng);
    const sizes: number[] = [];

    for (let round = 0; round <= FINAL_ROUND; round++) {
      sizes.push(tiesInRound(cup, round).length);
      cup = simulateRestOfRound(cup, rng);
      cup = advanceRound(cup, divisions, rng);
    }
    expect(sizes).toEqual([10, 16, 8, 4, 2, 1]);
  });

  it('never draws a club against itself or twice in a round', () => {
    const rng = createSeededRng(4);
    let cup = createCup(1, divisions, rng);

    for (let round = 0; round <= FINAL_ROUND; round++) {
      const ties = tiesInRound(cup, round);
      const clubs = ties.flatMap((t) => [t.homeClubId, t.awayClubId]);
      expect(new Set(clubs).size, `round ${round}`).toBe(clubs.length);
      for (const tie of ties) expect(tie.homeClubId).not.toBe(tie.awayClubId);
      cup = advanceRound(simulateRestOfRound(cup, rng), divisions, rng);
    }
  });

  it('produces exactly one winner', () => {
    for (const seed of [10, 20, 30, 40]) {
      const cup = playWholeCup(seed);
      expect(cup.winnerClubId).not.toBeNull();
      expect(tiesInRound(cup, FINAL_ROUND)).toHaveLength(1);
    }
  });

  it('settles every tie, including the level ones', () => {
    const cup = playWholeCup(50);
    for (const tie of cup.ties) {
      expect(tie.played).toBe(true);
      expect(tie.winnerClubId).not.toBeNull();
      expect([tie.homeClubId, tie.awayClubId]).toContain(tie.winnerClubId);
      // A level tie must have been decided on penalties.
      if (tie.homeScore === tie.awayScore) expect(tie.shootout).not.toBeNull();
    }
  });

  it('sends a lower-league club on a longer road than a top-flight one', () => {
    const rng = createSeededRng(60);
    const cup = createCup(1, divisions, rng);
    // League Two clubs are in from the preliminary round; the Premiership is not.
    const prelimClubs = tiesInRound(cup, 0).flatMap((t) => [t.homeClubId, t.awayClubId]);
    for (const clubId of divisions.premiership) {
      expect(prelimClubs).not.toContain(clubId);
    }
    for (const clubId of divisions['league-two']) {
      expect(prelimClubs).toContain(clubId);
    }
    // Five ties to win it from the Round of 32, six from the preliminary round.
    expect(FINAL_ROUND).toBe(5);
    expect(CUP_ROUNDS).toHaveLength(6);
  });

  it('lets a club from the bottom division win the whole thing', () => {
    // Over enough draws, somebody from below reaches at least the last eight.
    let bestRoundReached = 0;
    for (let seed = 0; seed < 40; seed++) {
      const rng = createSeededRng(seed);
      let cup = createCup(1, divisions, rng);
      for (let round = 0; round <= FINAL_ROUND; round++) {
        cup = advanceRound(simulateRestOfRound(cup, rng), divisions, rng);
      }
      for (const clubId of divisions['league-two']) {
        const lastRound = cup.ties
          .filter((t) => t.homeClubId === clubId || t.awayClubId === clubId)
          .reduce((max, t) => Math.max(max, t.round), -1);
        bestRoundReached = Math.max(bestRoundReached, lastRound);
      }
    }
    expect(bestRoundReached).toBeGreaterThanOrEqual(3);
  });

  it('finds the manager their tie in the current round', () => {
    const rng = createSeededRng(70);
    const cup = createCup(1, divisions, rng);
    const someClub = tiesInRound(cup, 0)[0].homeClubId;

    const tie = tieFor(cup, someClub);
    expect(tie).not.toBeNull();
    expect([tie!.homeClubId, tie!.awayClubId]).toContain(someClub);

    // A Premiership club is not in the preliminary round at all.
    expect(tieFor(cup, divisions.premiership[0])).toBeNull();
  });

  it('refuses to draw a round that cannot be paired off', () => {
    expect(() => drawRound(2, ['celtic', 'rangers', 'aberdeen'], divisions, createSeededRng(1))).toThrow();
  });
});
