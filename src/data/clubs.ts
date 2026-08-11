/**
 * The clubs.
 *
 * All fictional, all placeholders. Replacing these with real Scottish clubs is
 * a matter of swapping this array (or fetching the same shape from Supabase) —
 * squads, ratings and fixtures are all derived from it.
 */

import type { Club } from '../types';

export const CLUBS: Club[] = [
  {
    id: 'greenock-rovers',
    name: 'Greenock Rovers',
    shortName: 'Rovers',
    abbreviation: 'GRE',
    stadium: 'Ravenscraig Park',
    league: 'premiership',
    primaryColour: '#1f6feb',
    secondaryColour: '#0d2b56',
    profile: { attack: 68, midfield: 64, defence: 61, goalkeeper: 63 },
  },
  {
    id: 'inverclyde-fc',
    name: 'Inverclyde FC',
    shortName: 'Inverclyde',
    abbreviation: 'INV',
    stadium: 'The Esplanade',
    league: 'premiership',
    primaryColour: '#c9433f',
    secondaryColour: '#3c1210',
    profile: { attack: 59, midfield: 67, defence: 69, goalkeeper: 66 },
  },
  {
    id: 'clyde-valley-united',
    name: 'Clyde Valley United',
    shortName: 'Clyde Valley',
    abbreviation: 'CVU',
    stadium: 'Lanark Road',
    league: 'premiership',
    primaryColour: '#e0a020',
    secondaryColour: '#3a2a05',
    profile: { attack: 73, midfield: 58, defence: 55, goalkeeper: 57 },
  },
  {
    id: 'ayrshire-athletic',
    name: 'Ayrshire Athletic',
    shortName: 'Athletic',
    abbreviation: 'AYR',
    stadium: 'Carrick Street',
    league: 'premiership',
    primaryColour: '#2f9e6b',
    secondaryColour: '#0f3222',
    profile: { attack: 55, midfield: 61, defence: 63, goalkeeper: 62 },
  },
];

export const LEAGUE_NAMES: Record<Club['league'], string> = {
  premiership: 'Scottish Premiership',
  championship: 'Scottish Championship',
  'league-one': 'Scottish League One',
  'league-two': 'Scottish League Two',
};

export function getClub(id: string): Club {
  const club = CLUBS.find((c) => c.id === id);
  if (!club) throw new Error(`Unknown club: ${id}`);
  return club;
}
