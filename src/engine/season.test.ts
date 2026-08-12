import { describe, expect, it } from 'vitest';
import { CLUBS, divisionSizesMatch, startingDivisions } from '../data/clubs';
import { getLeague, LEAGUE_ORDER, LEAGUES, leagueAbove, leagueBelow } from '../data/leagues';
import { getClubWithSquad } from '../data/world';
import { generateFixtures } from './league';
import { createSeededRng } from './random';
import {
  buildSeasonTables,
  leagueOf,
  outcomeFor,
  resolvePromotionAndRelegation,
  simulateDivisionSeason,
} from './season';
import type { LeagueId } from '../types';

describe('the club list', () => {
  it('has all 42 SPFL clubs', () => {
    expect(CLUBS).toHaveLength(42);
  });

  it('fills every division to its stated size', () => {
    expect(divisionSizesMatch()).toBe(true);
    expect(LEAGUES.reduce((total, l) => total + l.size, 0)).toBe(42);
  });

  it('gives every club a unique id and abbreviation', () => {
    expect(new Set(CLUBS.map((c) => c.id)).size).toBe(CLUBS.length);
    expect(new Set(CLUBS.map((c) => c.abbreviation)).size).toBe(CLUBS.length);
  });

  it('gives every club a name, ground and colour', () => {
    for (const club of CLUBS) {
      expect(club.name.length).toBeGreaterThan(2);
      expect(club.shortName.length).toBeGreaterThan(2);
      expect(club.stadium.length).toBeGreaterThan(2);
      expect(club.primaryColour).toMatch(/^#[0-9a-f]{6}$/i);
      expect(club.abbreviation).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('ranks the divisions by strength on average', () => {
    const averageFor = (league: LeagueId) => {
      const clubs = CLUBS.filter((c) => c.league === league);
      const total = clubs.reduce(
        (sum, c) => sum + getClubWithSquad(c.id).ratings.overall,
        0,
      );
      return total / clubs.length;
    };
    // A higher division should, on average, be stronger than the one below.
    for (let i = 0; i < LEAGUE_ORDER.length - 1; i++) {
      expect(averageFor(LEAGUE_ORDER[i])).toBeGreaterThan(averageFor(LEAGUE_ORDER[i + 1]));
    }
  });

  it('can build a full squad for every single club', () => {
    for (const club of CLUBS) {
      const squad = getClubWithSquad(club.id);
      expect(squad.players).toHaveLength(18);
      expect(squad.players.filter((p) => p.position === 'GK').length).toBeGreaterThan(0);
      expect(squad.ratings.overall).toBeGreaterThan(0);
    }
  });
});

describe('the pyramid', () => {
  it('has nothing above the top or below the bottom', () => {
    expect(leagueAbove('premiership')).toBeNull();
    expect(leagueBelow('league-two')).toBeNull();
    expect(leagueBelow('premiership')).toBe('championship');
    expect(leagueAbove('league-two')).toBe('league-one');
  });

  it('places every club in exactly one division at the start', () => {
    const divisions = startingDivisions();
    const all = LEAGUE_ORDER.flatMap((league) => divisions[league]);
    expect(all).toHaveLength(42);
    expect(new Set(all).size).toBe(42);
  });
});

describe('a simulated division season', () => {
  it('produces a complete table', () => {
    const rng = createSeededRng(11);
    const divisions = startingDivisions();
    const table = simulateDivisionSeason(divisions['league-one'], rng);

    expect(table).toHaveLength(10);
    for (const row of table) {
      // Double round robin: everyone plays everyone home and away.
      expect(row.played).toBe(18);
      expect(row.won + row.drawn + row.lost).toBe(18);
      expect(row.points).toBe(row.won * 3 + row.drawn);
    }
  });

  it('balances goals scored against goals conceded across the division', () => {
    const rng = createSeededRng(12);
    const divisions = startingDivisions();
    const table = simulateDivisionSeason(divisions['championship'], rng);
    const scored = table.reduce((t, r) => t + r.goalsFor, 0);
    const conceded = table.reduce((t, r) => t + r.goalsAgainst, 0);
    expect(scored).toBe(conceded);
  });
});

describe('promotion and relegation', () => {
  const divisions = startingDivisions();

  function settle(seed: number) {
    const rng = createSeededRng(seed);
    const fixtures = generateFixtures(divisions.premiership).map((fixture) => ({
      ...fixture,
      homeScore: 1,
      awayScore: 0,
      played: true,
    }));
    const tables = buildSeasonTables(divisions, 'premiership', fixtures, rng);
    return { tables, ...resolvePromotionAndRelegation(divisions, tables) };
  }

  it('keeps every division the right size afterwards', () => {
    const { divisions: next } = settle(1);
    for (const league of LEAGUE_ORDER) {
      expect(next[league], league).toHaveLength(getLeague(league).size);
    }
  });

  it('never loses or duplicates a club', () => {
    const { divisions: next } = settle(2);
    const all = LEAGUE_ORDER.flatMap((league) => next[league]);
    expect(all).toHaveLength(42);
    expect(new Set(all).size).toBe(42);
  });

  it('swaps the bottom club with the champion below', () => {
    const { tables, divisions: next } = settle(3);

    for (let i = 0; i < LEAGUE_ORDER.length - 1; i++) {
      const upper = LEAGUE_ORDER[i];
      const lower = LEAGUE_ORDER[i + 1];
      const relegated = tables[upper][tables[upper].length - 1].clubId;
      const champion = tables[lower][0].clubId;

      expect(next[lower], `${relegated} should drop to ${lower}`).toContain(relegated);
      expect(next[upper], `${champion} should rise to ${upper}`).toContain(champion);
      expect(next[upper]).not.toContain(relegated);
      expect(next[lower]).not.toContain(champion);
    }
  });

  it('never relegates out of the bottom division', () => {
    const { tables, divisions: next } = settle(4);
    const bottomClub = tables['league-two'][tables['league-two'].length - 1].clubId;
    expect(next['league-two']).toContain(bottomClub);
  });

  it('never promotes out of the top division', () => {
    const { tables, results } = settle(5);
    const champion = tables.premiership[0].clubId;
    const top = results.find((r) => r.league === 'premiership')!;
    expect(top.promoted).toHaveLength(0);
    // Winning the top flight is a title, not a promotion.
    expect(outcomeFor(champion, 'premiership', results)).toBe('champion');
  });

  it('reads the right outcome for a club that went down', () => {
    const { tables, results } = settle(6);
    const relegated = tables.championship[tables.championship.length - 1].clubId;
    expect(outcomeFor(relegated, 'championship', results)).toBe('relegated');
  });

  it('calls the division winner below the top flight a champion', () => {
    const { tables, results } = settle(7);
    const champion = tables['league-one'][0].clubId;
    expect(outcomeFor(champion, 'league-one', results)).toBe('champion');
  });

  it('reports a mid-table club as having gone nowhere', () => {
    const { tables, results } = settle(8);
    const midTable = tables.championship[4].clubId;
    expect(outcomeFor(midTable, 'championship', results)).toBe('none');
  });

  it('survives many seasons in a row without corrupting the pyramid', () => {
    let current = startingDivisions();
    const rng = createSeededRng(99);

    for (let season = 0; season < 25; season++) {
      const tables = {} as Record<LeagueId, ReturnType<typeof simulateDivisionSeason>>;
      for (const league of LEAGUE_ORDER) {
        tables[league] = simulateDivisionSeason(current[league], rng);
      }
      current = resolvePromotionAndRelegation(current, tables).divisions;

      const all = LEAGUE_ORDER.flatMap((league) => current[league]);
      expect(all, `season ${season}`).toHaveLength(42);
      expect(new Set(all).size, `season ${season}`).toBe(42);
      for (const league of LEAGUE_ORDER) {
        expect(current[league].length, `${league} season ${season}`).toBe(
          getLeague(league).size,
        );
      }
    }
  });

  it('lets a club climb the pyramid over enough seasons', () => {
    // Start a strong club at the bottom and check the system can carry it up.
    let current = startingDivisions();
    const climber = 'celtic';
    current = {
      premiership: current.premiership.filter((id) => id !== climber).concat('stranraer'),
      championship: current.championship,
      'league-one': current['league-one'],
      'league-two': current['league-two']
        .filter((id) => id !== 'stranraer')
        .concat(climber),
    };

    const rng = createSeededRng(7);
    let reached: LeagueId = 'league-two';
    for (let season = 0; season < 6; season++) {
      const tables = {} as Record<LeagueId, ReturnType<typeof simulateDivisionSeason>>;
      for (const league of LEAGUE_ORDER) {
        tables[league] = simulateDivisionSeason(current[league], rng);
      }
      current = resolvePromotionAndRelegation(current, tables).divisions;
      reached = leagueOf(climber, current);
    }
    expect(LEAGUE_ORDER.indexOf(reached)).toBeLessThan(LEAGUE_ORDER.indexOf('league-two'));
  });
});

describe('fixture lists at real division sizes', () => {
  it('gives a 12-club division 22 rounds and a 10-club division 18', () => {
    const divisions = startingDivisions();
    const premiership = generateFixtures(divisions.premiership);
    const championship = generateFixtures(divisions.championship);

    expect(new Set(premiership.map((f) => f.round)).size).toBe(22);
    expect(premiership).toHaveLength(12 * 11);
    expect(new Set(championship.map((f) => f.round)).size).toBe(18);
    expect(championship).toHaveLength(10 * 9);
  });

  it('gives every club the same number of home and away games', () => {
    const divisions = startingDivisions();
    for (const league of LEAGUE_ORDER) {
      const fixtures = generateFixtures(divisions[league]);
      for (const clubId of divisions[league]) {
        const home = fixtures.filter((f) => f.homeClubId === clubId).length;
        const away = fixtures.filter((f) => f.awayClubId === clubId).length;
        expect(home, `${clubId} home`).toBe(getLeague(league).size - 1);
        expect(away, `${clubId} away`).toBe(getLeague(league).size - 1);
      }
    }
  });
});
