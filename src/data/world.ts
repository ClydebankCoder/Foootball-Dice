/**
 * Composes clubs with their squads and derived ratings.
 *
 * This is the single place the rest of the app asks for "a club", which means
 * swapping in Supabase-backed data later is a change to this module only.
 */

import { deriveClubRatings } from '../engine/ratings';
import type { ClubWithSquad } from '../types';
import { CLUBS } from './clubs';
import { buildSquad } from './squads';

const CACHE = new Map<string, ClubWithSquad>();

export function getClubWithSquad(clubId: string): ClubWithSquad {
  const cached = CACHE.get(clubId);
  if (cached) return cached;

  const club = CLUBS.find((c) => c.id === clubId);
  if (!club) throw new Error(`Unknown club: ${clubId}`);

  const players = buildSquad(club);
  const built: ClubWithSquad = {
    ...club,
    players,
    ratings: deriveClubRatings(players),
  };
  CACHE.set(clubId, built);
  return built;
}

export function getAllClubsWithSquads(): ClubWithSquad[] {
  return CLUBS.map((club) => getClubWithSquad(club.id));
}
