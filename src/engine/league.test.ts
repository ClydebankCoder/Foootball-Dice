import { describe, expect, it } from 'vitest';
import { computeTable, generateFixtures, ordinal, positionOf, simulateFixture } from './league';
import { startingDivisions } from '../data/clubs';
import { createSeededRng } from './random';
import type { Fixture } from '../types';

// One real division, rather than all 42 clubs in a single imaginary league.
const clubIds = startingDivisions()['league-two'];

describe('the fixture list', () => {
  it('has every club playing every other home and away', () => {
    const fixtures = generateFixtures(clubIds);
    expect(fixtures).toHaveLength(clubIds.length * (clubIds.length - 1));

    for (const home of clubIds) {
      for (const away of clubIds) {
        if (home === away) continue;
        const match = fixtures.filter((f) => f.homeClubId === home && f.awayClubId === away);
        expect(match).toHaveLength(1);
      }
    }
  });

  it('gives every club the same number of games', () => {
    const fixtures = generateFixtures(clubIds);
    for (const id of clubIds) {
      const games = fixtures.filter((f) => f.homeClubId === id || f.awayClubId === id);
      expect(games).toHaveLength((clubIds.length - 1) * 2);
    }
  });

  it('never schedules a club twice in the same round', () => {
    const fixtures = generateFixtures(clubIds);
    const rounds = new Set(fixtures.map((f) => f.round));
    for (const round of rounds) {
      const inRound = fixtures.filter((f) => f.round === round);
      const clubsInRound = inRound.flatMap((f) => [f.homeClubId, f.awayClubId]);
      expect(new Set(clubsInRound).size).toBe(clubsInRound.length);
    }
  });
});

describe('the table', () => {
  const played = (
    home: string,
    away: string,
    homeScore: number,
    awayScore: number,
  ): Fixture => ({
    id: `${home}-${away}`,
    round: 1,
    homeClubId: home,
    awayClubId: away,
    homeScore,
    awayScore,
    played: true,
  });

  it('awards three for a win and one for a draw', () => {
    const table = computeTable(clubIds, [
      played(clubIds[0], clubIds[1], 2, 1),
      played(clubIds[2], clubIds[3], 0, 0),
    ]);
    const winner = table.find((r) => r.clubId === clubIds[0])!;
    const loser = table.find((r) => r.clubId === clubIds[1])!;
    const drawer = table.find((r) => r.clubId === clubIds[2])!;

    expect(winner.points).toBe(3);
    expect(winner.won).toBe(1);
    expect(winner.goalsFor).toBe(2);
    expect(winner.goalsAgainst).toBe(1);
    expect(winner.goalDifference).toBe(1);
    expect(loser.points).toBe(0);
    expect(loser.lost).toBe(1);
    expect(drawer.points).toBe(1);
    expect(drawer.drawn).toBe(1);
  });

  it('ignores fixtures that have not been played', () => {
    const table = computeTable(clubIds, [
      { ...played(clubIds[0], clubIds[1], 5, 0), played: false },
    ]);
    expect(table.every((row) => row.played === 0)).toBe(true);
  });

  it('sorts on points, then goal difference, then goals scored', () => {
    const table = computeTable(clubIds, [
      played(clubIds[0], clubIds[1], 1, 0),
      played(clubIds[2], clubIds[3], 4, 0),
      played(clubIds[1], clubIds[0], 0, 0),
      played(clubIds[3], clubIds[2], 0, 0),
    ]);
    expect(table[0].clubId).toBe(clubIds[2]);
    expect(table[1].clubId).toBe(clubIds[0]);
    expect(positionOf(table, clubIds[2])).toBe(1);
  });

  it('lists every club even before a ball is kicked', () => {
    const table = computeTable(clubIds, []);
    expect(table).toHaveLength(clubIds.length);
    expect(table.every((row) => row.points === 0 && row.played === 0)).toBe(true);
  });
});

describe('simulated results', () => {
  it('produces non-negative, plausible scorelines', () => {
    const rng = createSeededRng(2020);
    for (let i = 0; i < 300; i++) {
      const { homeScore, awayScore } = simulateFixture(clubIds[0], clubIds[1], rng);
      expect(homeScore).toBeGreaterThanOrEqual(0);
      expect(awayScore).toBeGreaterThanOrEqual(0);
      expect(homeScore).toBeLessThanOrEqual(9);
      expect(awayScore).toBeLessThanOrEqual(9);
    }
  });
});

describe('ordinals', () => {
  it('reads the way a league table does', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(21)).toBe('21st');
  });
});
