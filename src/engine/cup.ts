/**
 * Cup draws, rounds and the ties the manager is not in.
 *
 * The manager plays their own tie; the rest of the round is resolved the same
 * way league fixtures they are not in are — ratings shift the odds, the dice
 * decide, and a level tie goes to a quick shootout so that every round
 * produces exactly one winner per tie.
 */

import { CUP_ROUNDS, FINAL_ROUND, getCupRound } from '../data/cup';
import { getClubWithSquad } from '../data/world';
import type { CupState, CupTie, LeagueId } from '../types';
import { embellishScoreline, simulateFixture } from './league';
import { chance, shuffle, type Rng } from './random';

/** Clubs entering the competition at a given round. */
export function entrantsFor(
  round: number,
  divisions: Record<LeagueId, string[]>,
): string[] {
  return getCupRound(round).entrants.flatMap((league) => divisions[league] ?? []);
}

/**
 * Makes the draw for a round.
 *
 * Open and unseeded: the hat is shuffled and paired off, and the first club
 * out of each pair is at home.
 */
export function drawRound(
  round: number,
  survivors: string[],
  divisions: Record<LeagueId, string[]>,
  rng: Rng,
): CupTie[] {
  const pool = [...survivors, ...entrantsFor(round, divisions)];
  if (pool.length % 2 !== 0) {
    throw new Error(
      `Cup round ${round} has ${pool.length} clubs, which cannot be paired off`,
    );
  }

  const hat = shuffle(rng, pool);
  const ties: CupTie[] = [];
  for (let i = 0; i < hat.length; i += 2) {
    ties.push({
      id: `cup-r${round}-${hat[i]}-v-${hat[i + 1]}`,
      round,
      homeClubId: hat[i],
      awayClubId: hat[i + 1],
      homeScore: null,
      awayScore: null,
      shootout: null,
      winnerClubId: null,
      played: false,
    });
  }
  return ties;
}

export function createCup(
  season: number,
  divisions: Record<LeagueId, string[]>,
  rng: Rng,
): CupState {
  const ties = drawRound(0, [], divisions, rng);
  return {
    season,
    round: 0,
    ties,
    remaining: [...entrantsFor(0, divisions), ...entrantsFor(1, divisions)],
    winnerClubId: null,
    eliminatedInRound: null,
  };
}

/** The manager's tie in the current round, if they are in it. */
export function tieFor(cup: CupState, clubId: string): CupTie | null {
  return (
    cup.ties.find(
      (tie) =>
        tie.round === cup.round &&
        !tie.played &&
        (tie.homeClubId === clubId || tie.awayClubId === clubId),
    ) ?? null
  );
}

export function tiesInRound(cup: CupState, round: number): CupTie[] {
  return cup.ties.filter((tie) => tie.round === round);
}

/**
 * Settles a tie that the manager took no part in.
 *
 * A level result after ninety goes to a shootout decided by goalkeeping and
 * composure — the same inputs the manager's own shootout uses, resolved in one
 * step rather than kick by kick.
 */
export function simulateTie(tie: CupTie, rng: Rng): CupTie {
  const result = embellishScoreline(
    simulateFixture(tie.homeClubId, tie.awayClubId, rng),
    rng,
  );

  if (result.homeScore !== result.awayScore) {
    return {
      ...tie,
      ...result,
      shootout: null,
      played: true,
      winnerClubId:
        result.homeScore > result.awayScore ? tie.homeClubId : tie.awayClubId,
    };
  }

  const home = getClubWithSquad(tie.homeClubId);
  const away = getClubWithSquad(tie.awayClubId);
  const homeEdge =
    50 + (home.ratings.goalkeeper - away.ratings.goalkeeper) * 0.6;
  const homeWins = chance(rng, Math.min(80, Math.max(20, Math.round(homeEdge))));

  // Believable shootout scorelines rather than a bare flag.
  const winnerScore = 5 - Math.floor(rng.next() * 2);
  const loserScore = winnerScore - 1 - Math.floor(rng.next() * 2);

  return {
    ...tie,
    ...result,
    played: true,
    shootout: homeWins
      ? { home: winnerScore, away: Math.max(0, loserScore) }
      : { home: Math.max(0, loserScore), away: winnerScore },
    winnerClubId: homeWins ? tie.homeClubId : tie.awayClubId,
  };
}

/** Records the result of the tie the manager played. */
export function recordTieResult(
  cup: CupState,
  tieId: string,
  result: {
    homeScore: number;
    awayScore: number;
    shootout: { home: number; away: number } | null;
    winnerClubId: string;
  },
): CupState {
  return {
    ...cup,
    ties: cup.ties.map((tie) =>
      tie.id === tieId ? { ...tie, ...result, played: true } : tie,
    ),
  };
}

/** Plays out every remaining tie in the current round. */
export function simulateRestOfRound(cup: CupState, rng: Rng): CupState {
  return {
    ...cup,
    ties: cup.ties.map((tie) =>
      tie.round === cup.round && !tie.played ? simulateTie(tie, rng) : tie,
    ),
  };
}

export function roundComplete(cup: CupState): boolean {
  return tiesInRound(cup, cup.round).every((tie) => tie.played);
}

/**
 * Moves the cup on: takes the winners, adds any clubs entering at the next
 * round, and makes the draw.
 */
export function advanceRound(
  cup: CupState,
  divisions: Record<LeagueId, string[]>,
  rng: Rng,
): CupState {
  const winners = tiesInRound(cup, cup.round)
    .map((tie) => tie.winnerClubId)
    .filter((id): id is string => id !== null);

  if (cup.round >= FINAL_ROUND) {
    return { ...cup, winnerClubId: winners[0] ?? null, remaining: winners };
  }

  const nextRound = cup.round + 1;
  const ties = drawRound(nextRound, winners, divisions, rng);
  return {
    ...cup,
    round: nextRound,
    ties: [...cup.ties, ...ties],
    remaining: [...winners, ...entrantsFor(nextRound, divisions)],
  };
}

/** True once the manager's club has been knocked out or has lifted the cup. */
export function cupOver(cup: CupState): boolean {
  return cup.winnerClubId !== null || cup.eliminatedInRound !== null;
}

/** How far a club got, as a readable phrase. */
export function progressLabel(cup: CupState, clubId: string): string {
  if (cup.winnerClubId === clubId) return 'Winners';
  if (cup.eliminatedInRound === null) {
    return `In the ${getCupRound(cup.round).name}`;
  }
  const round = getCupRound(cup.eliminatedInRound);
  return cup.eliminatedInRound === FINAL_ROUND
    ? 'Runners-up'
    : `Out in the ${round.name}`;
}

export { CUP_ROUNDS, FINAL_ROUND, getCupRound };
