/**
 * League scheduling, quick simulation of matches the manager is not in, and
 * the table.
 *
 * Deliberately small: one division, a double round robin, three points for a
 * win. It exists so that a match result means something, not to be a season
 * engine.
 */

import { getClubWithSquad } from '../data/world';
import type { Fixture, TableRow } from '../types';
import { chance, randomInt, rollD100, type Rng } from './random';

/** Circle-method double round robin. Every club plays every other home and away. */
export function generateFixtures(clubIds: string[]): Fixture[] {
  const teams = [...clubIds];
  if (teams.length % 2 !== 0) teams.push('__bye__');

  const roundsPerHalf = teams.length - 1;
  const half = teams.length / 2;
  const fixtures: Fixture[] = [];
  const rotation = [...teams];

  for (let round = 0; round < roundsPerHalf; round++) {
    for (let i = 0; i < half; i++) {
      const home = rotation[i];
      const away = rotation[rotation.length - 1 - i];
      if (home === '__bye__' || away === '__bye__') continue;

      // Alternate home advantage between rounds so it stays fair.
      const flip = round % 2 === 1;
      fixtures.push(makeFixture(round + 1, flip ? away : home, flip ? home : away));
      fixtures.push(
        makeFixture(round + 1 + roundsPerHalf, flip ? home : away, flip ? away : home),
      );
    }
    // Rotate all but the first entry.
    rotation.splice(1, 0, rotation.pop() as string);
  }

  return fixtures.sort((a, b) => a.round - b.round);
}

function makeFixture(round: number, homeClubId: string, awayClubId: string): Fixture {
  return {
    id: `r${round}-${homeClubId}-v-${awayClubId}`,
    round,
    homeClubId,
    awayClubId,
    homeScore: null,
    awayScore: null,
    played: false,
  };
}

/**
 * A fast result for matches the manager did not play.
 *
 * Uses the same "strength shifts the odds, the dice decide" philosophy as the
 * match engine, so an upset is always on the cards.
 */
export function simulateFixture(
  homeClubId: string,
  awayClubId: string,
  rng: Rng,
): { homeScore: number; awayScore: number } {
  const home = getClubWithSquad(homeClubId);
  const away = getClubWithSquad(awayClubId);

  const scoreFor = (attack: number, defence: number, goalkeeper: number, homeBoost: number) => {
    const quality = 26 + homeBoost + (attack - (defence * 0.6 + goalkeeper * 0.4)) * 1.1;
    const chances = randomInt(rng, 6, 13);
    let goals = 0;
    for (let i = 0; i < chances; i++) {
      if (rollD100(rng) <= Math.min(60, Math.max(6, Math.round(quality * 0.45)))) goals += 1;
    }
    return goals;
  };

  return {
    homeScore: scoreFor(home.ratings.attack, away.ratings.defence, away.ratings.goalkeeper, 5),
    awayScore: scoreFor(away.ratings.attack, home.ratings.defence, home.ratings.goalkeeper, 0),
  };
}

/** Occasionally a scoreline just needs a late goal to be believable. */
export function embellishScoreline(
  result: { homeScore: number; awayScore: number },
  rng: Rng,
): { homeScore: number; awayScore: number } {
  if (result.homeScore === 0 && result.awayScore === 0 && chance(rng, 35)) {
    return chance(rng, 55)
      ? { homeScore: 1, awayScore: 0 }
      : { homeScore: 0, awayScore: 1 };
  }
  return result;
}

function emptyRow(clubId: string): TableRow {
  return {
    clubId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

export function computeTable(clubIds: string[], fixtures: Fixture[]): TableRow[] {
  const rows = new Map<string, TableRow>(clubIds.map((id) => [id, emptyRow(id)]));

  for (const fixture of fixtures) {
    if (!fixture.played || fixture.homeScore === null || fixture.awayScore === null) continue;
    const home = rows.get(fixture.homeClubId);
    const away = rows.get(fixture.awayClubId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += fixture.homeScore;
    home.goalsAgainst += fixture.awayScore;
    away.goalsFor += fixture.awayScore;
    away.goalsAgainst += fixture.homeScore;

    if (fixture.homeScore > fixture.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (fixture.homeScore < fixture.awayScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  return [...rows.values()]
    .map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.clubId.localeCompare(b.clubId),
    );
}

export function positionOf(table: TableRow[], clubId: string): number {
  return table.findIndex((row) => row.clubId === clubId) + 1;
}

export function ordinal(position: number): string {
  const suffix =
    position % 100 >= 11 && position % 100 <= 13
      ? 'th'
      : position % 10 === 1
        ? 'st'
        : position % 10 === 2
          ? 'nd'
          : position % 10 === 3
            ? 'rd'
            : 'th';
  return `${position}${suffix}`;
}
