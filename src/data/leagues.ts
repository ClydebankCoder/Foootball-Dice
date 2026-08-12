/**
 * The four SPFL divisions.
 *
 * `tier` drives everything about promotion and relegation: tier 1 sits at the
 * top, and a club is only ever moved between adjacent tiers.
 */

import type { LeagueId } from '../types';

export interface LeagueDefinition {
  id: LeagueId;
  name: string;
  shortName: string;
  tier: number;
  size: number;
}

export const LEAGUES: LeagueDefinition[] = [
  { id: 'premiership', name: 'Scottish Premiership', shortName: 'Premiership', tier: 1, size: 12 },
  { id: 'championship', name: 'Scottish Championship', shortName: 'Championship', tier: 2, size: 10 },
  { id: 'league-one', name: 'Scottish League One', shortName: 'League One', tier: 3, size: 10 },
  { id: 'league-two', name: 'Scottish League Two', shortName: 'League Two', tier: 4, size: 10 },
];

/** Top tier first — the order promotion and relegation walks. */
export const LEAGUE_ORDER: LeagueId[] = LEAGUES.map((league) => league.id);

export function getLeague(id: LeagueId): LeagueDefinition {
  const league = LEAGUES.find((l) => l.id === id);
  if (!league) throw new Error(`Unknown league: ${id}`);
  return league;
}

/** The division one place above, or null at the top of the pyramid. */
export function leagueAbove(id: LeagueId): LeagueId | null {
  const index = LEAGUE_ORDER.indexOf(id);
  return index > 0 ? LEAGUE_ORDER[index - 1] : null;
}

/** The division one place below, or null at the bottom of the pyramid. */
export function leagueBelow(id: LeagueId): LeagueId | null {
  const index = LEAGUE_ORDER.indexOf(id);
  return index >= 0 && index < LEAGUE_ORDER.length - 1 ? LEAGUE_ORDER[index + 1] : null;
}
