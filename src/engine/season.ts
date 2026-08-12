/**
 * End of season: promotion, relegation, and the divisions the manager was
 * never in.
 *
 * The manager plays one division. The other three still have to produce a
 * table, because a club coming up has to come from somewhere — so they are
 * simulated in full at the final whistle of the season rather than tracked
 * week by week. Same ratings, same dice, same upsets as the manager's own
 * division, just resolved all at once.
 */

import { LEAGUE_ORDER, leagueBelow } from '../data/leagues';
import type {
  DivisionResult,
  Fixture,
  LeagueId,
  SeasonOutcome,
  TableRow,
} from '../types';
import {
  computeTable,
  embellishScoreline,
  generateFixtures,
  simulateFixture,
} from './league';
import type { Rng } from './random';

/** How many clubs go up and down between each pair of divisions. */
export const PROMOTION_PLACES = 1;
export const RELEGATION_PLACES = 1;

/** Plays out a whole division that the manager took no part in. */
export function simulateDivisionSeason(clubIds: string[], rng: Rng): TableRow[] {
  const fixtures: Fixture[] = generateFixtures(clubIds).map((fixture) => {
    const result = embellishScoreline(
      simulateFixture(fixture.homeClubId, fixture.awayClubId, rng),
      rng,
    );
    return { ...fixture, ...result, played: true };
  });
  return computeTable(clubIds, fixtures);
}

export interface SeasonTables {
  /** Final table for every division, keyed by league. */
  tables: Record<LeagueId, TableRow[]>;
}

/**
 * Builds the final table for all four divisions.
 *
 * The manager's own division comes from the fixtures they actually played; the
 * rest are simulated.
 */
export function buildSeasonTables(
  divisions: Record<LeagueId, string[]>,
  managerLeague: LeagueId,
  managerFixtures: Fixture[],
  rng: Rng,
): Record<LeagueId, TableRow[]> {
  const tables = {} as Record<LeagueId, TableRow[]>;
  for (const league of LEAGUE_ORDER) {
    const clubIds = divisions[league] ?? [];
    tables[league] =
      league === managerLeague
        ? computeTable(clubIds, managerFixtures)
        : simulateDivisionSeason(clubIds, rng);
  }
  return tables;
}

/**
 * Works out who goes up and who goes down.
 *
 * Bottom of a division swaps with the champion of the one below. The top
 * division has nothing above it and the bottom division has nothing below it
 * in this game — there is no pyramid beneath League Two here, so its bottom
 * club simply stays up.
 */
export function resolvePromotionAndRelegation(
  divisions: Record<LeagueId, string[]>,
  tables: Record<LeagueId, TableRow[]>,
): { divisions: Record<LeagueId, string[]>; results: DivisionResult[] } {
  const promotedFrom = {} as Record<LeagueId, string[]>;
  const relegatedFrom = {} as Record<LeagueId, string[]>;

  for (const league of LEAGUE_ORDER) {
    const table = tables[league] ?? [];
    const below = leagueBelow(league);

    // Only relegate if there is somewhere to relegate to.
    relegatedFrom[league] =
      below === null
        ? []
        : table.slice(-RELEGATION_PLACES).map((row) => row.clubId);

    // Only promote if there is somewhere to be promoted to.
    const above = LEAGUE_ORDER.indexOf(league) > 0;
    promotedFrom[league] = above
      ? table.slice(0, PROMOTION_PLACES).map((row) => row.clubId)
      : [];
  }

  const next = {} as Record<LeagueId, string[]>;
  for (const league of LEAGUE_ORDER) {
    const below = leagueBelow(league);
    const staying = (divisions[league] ?? []).filter(
      (clubId) => !relegatedFrom[league].includes(clubId),
    );
    const arriving = below ? promotedFrom[below] : [];
    // Clubs relegated into this division from above.
    const index = LEAGUE_ORDER.indexOf(league);
    const above = index > 0 ? LEAGUE_ORDER[index - 1] : null;
    const droppingIn = above ? relegatedFrom[above] : [];

    next[league] = [...staying, ...arriving, ...droppingIn].filter(
      (clubId) => !promotedFrom[league].includes(clubId),
    );
  }

  const results: DivisionResult[] = LEAGUE_ORDER.map((league) => ({
    league,
    table: tables[league] ?? [],
    promoted: promotedFrom[league],
    relegated: relegatedFrom[league],
  }));

  return { divisions: next, results };
}

/** What a given club's season amounted to. */
export function outcomeFor(
  clubId: string,
  league: LeagueId,
  results: DivisionResult[],
): SeasonOutcome {
  const division = results.find((result) => result.league === league);
  if (!division) return 'none';
  if (division.relegated.includes(clubId)) return 'relegated';
  if (division.promoted.includes(clubId)) {
    return division.table[0]?.clubId === clubId ? 'champion' : 'promoted';
  }
  // Winning the top division is a title without a promotion.
  if (division.table[0]?.clubId === clubId) return 'champion';
  return 'none';
}

/** Where a club will play next season, given the new division lists. */
export function leagueOf(
  clubId: string,
  divisions: Record<LeagueId, string[]>,
): LeagueId {
  for (const league of LEAGUE_ORDER) {
    if ((divisions[league] ?? []).includes(clubId)) return league;
  }
  throw new Error(`Club ${clubId} is not in any division`);
}
