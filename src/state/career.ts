/**
 * The manager's career: club, tactics, the division they are in, fixtures,
 * results, records and every season they have completed.
 *
 * Persisted to localStorage so a refresh never costs progress. The shape
 * mirrors the planned Supabase tables, so moving to accounts later means
 * changing where this is read from and written to, not what it contains.
 */

import { getClub, startingDivisions } from '../data/clubs';
import { LEAGUE_ORDER } from '../data/leagues';
import {
  computeTable,
  embellishScoreline,
  generateFixtures,
  simulateFixture,
} from '../engine/league';
import { createRng } from '../engine/random';
import {
  buildSeasonTables,
  leagueOf,
  outcomeFor,
  resolvePromotionAndRelegation,
} from '../engine/season';
import type {
  Career,
  Fixture,
  LeagueId,
  MatchSummary,
  SeasonRecord,
  SeasonSummary,
  TableRow,
  Tactics,
} from '../types';

/**
 * Bumped to 2 when real clubs, divisions and seasons arrived. A version 1
 * save has no division table and cannot be migrated meaningfully, so it is
 * discarded rather than half-loaded.
 */
export const CAREER_VERSION = 2;
const STORAGE_KEY = 'football-dice:career';
/** Matches kept in the save. Enough for form; not enough to bloat storage. */
const HISTORY_LIMIT = 40;

export const DEFAULT_TACTICS: Tactics = {
  mentality: 'balanced',
  passing: 'mixed',
  tempo: 'normal',
  pressing: 'medium',
};

export function createCareer(managerName: string, clubId: string): Career {
  const divisions = startingDivisions();
  const league = getClub(clubId).league;

  return {
    version: CAREER_VERSION,
    managerName: managerName.trim() || 'The Gaffer',
    clubId,
    tutorialSeen: false,
    tactics: { ...DEFAULT_TACTICS },
    season: 1,
    divisions,
    fixtures: generateFixtures(divisions[league]),
    records: {
      lowestSuccessfulProbability: null,
      lowestSuccessfulActionName: null,
      actionsAttempted: 0,
      actionsSuccessful: 0,
    },
    history: [],
    seasons: [],
    pendingSeasonSummary: null,
  };
}

/** The division the manager is in this season. */
export function currentLeague(career: Career): LeagueId {
  return leagueOf(career.clubId, career.divisions);
}

export function currentDivisionClubs(career: Career): string[] {
  return career.divisions[currentLeague(career)] ?? [];
}

export function tableFor(career: Career): TableRow[] {
  return computeTable(currentDivisionClubs(career), career.fixtures);
}

/** The manager's next unplayed fixture, or null when the season is done. */
export function nextFixture(career: Career): Fixture | null {
  return (
    career.fixtures.find(
      (fixture) =>
        !fixture.played &&
        (fixture.homeClubId === career.clubId || fixture.awayClubId === career.clubId),
    ) ?? null
  );
}

export function seasonComplete(career: Career): boolean {
  return nextFixture(career) === null;
}

/**
 * Records the manager's result and simulates the rest of that round, so the
 * table always moves on with them.
 */
export function completeFixture(career: Career, summary: MatchSummary): Career {
  const rng = createRng();
  const played = career.fixtures.find((fixture) => fixture.id === summary.fixtureId);
  const round = played?.round ?? null;

  const fixtures = career.fixtures.map((fixture) => {
    if (fixture.id === summary.fixtureId) {
      return {
        ...fixture,
        homeScore: summary.homeScore,
        awayScore: summary.awayScore,
        played: true,
      };
    }
    const isSameRound = round !== null && fixture.round === round;
    if (isSameRound && !fixture.played) {
      const result = embellishScoreline(
        simulateFixture(fixture.homeClubId, fixture.awayClubId, rng),
        rng,
      );
      return { ...fixture, ...result, played: true };
    }
    return fixture;
  });

  const records = { ...career.records };
  for (const decision of summary.decisions) {
    records.actionsAttempted += 1;
    if (!decision.success) continue;
    records.actionsSuccessful += 1;
    if (
      records.lowestSuccessfulProbability === null ||
      decision.probability < records.lowestSuccessfulProbability
    ) {
      records.lowestSuccessfulProbability = decision.probability;
      records.lowestSuccessfulActionName = decision.actionName;
    }
  }

  return {
    ...career,
    fixtures,
    records,
    history: [...career.history, summary].slice(-HISTORY_LIMIT),
  };
}

/* ------------------------------------------------------------- season end */

/**
 * Closes the season: settles every division, works out who went up and down,
 * and files the manager's own record.
 *
 * The new division lists are stored, but the next season's fixtures are not
 * generated until the summary has been reviewed — so the manager sees where
 * they finished before being handed a new calendar.
 */
export function finishSeason(career: Career): Career {
  const rng = createRng();
  const league = currentLeague(career);
  const tables = buildSeasonTables(career.divisions, league, career.fixtures, rng);
  const { divisions, results } = resolvePromotionAndRelegation(career.divisions, tables);

  const table = tables[league];
  const position = table.findIndex((row) => row.clubId === career.clubId) + 1;
  const row = table.find((r) => r.clubId === career.clubId);
  const outcome = outcomeFor(career.clubId, league, results);

  const managerRecord: SeasonRecord = {
    season: career.season,
    league,
    position,
    played: row?.played ?? 0,
    won: row?.won ?? 0,
    drawn: row?.drawn ?? 0,
    lost: row?.lost ?? 0,
    goalsFor: row?.goalsFor ?? 0,
    goalsAgainst: row?.goalsAgainst ?? 0,
    points: row?.points ?? 0,
    outcome,
  };

  const summary: SeasonSummary = {
    season: career.season,
    league,
    divisions: results,
    managerRecord,
    nextLeague: leagueOf(career.clubId, divisions),
  };

  return {
    ...career,
    divisions,
    seasons: [...career.seasons, managerRecord],
    pendingSeasonSummary: summary,
  };
}

/** Starts the next season once the summary has been read. */
export function startNextSeason(career: Career): Career {
  const league = currentLeague(career);
  return {
    ...career,
    season: career.season + 1,
    fixtures: generateFixtures(career.divisions[league]),
    history: [],
    pendingSeasonSummary: null,
  };
}

export function setTactics(career: Career, tactics: Tactics): Career {
  return { ...career, tactics };
}

export function markTutorialSeen(career: Career): Career {
  return { ...career, tutorialSeen: true };
}

/* --------------------------------------------------------------- persistence */

export function saveCareer(career: Career): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(career));
  } catch {
    // Private browsing or a full quota. The game keeps working in memory.
  }
}

/** Rejects anything we cannot trust to be a complete, current career. */
function looksValid(parsed: Partial<Career>): parsed is Career {
  if (parsed?.version !== CAREER_VERSION) return false;
  if (!parsed.clubId || !Array.isArray(parsed.fixtures)) return false;
  if (!parsed.divisions) return false;
  // Every division must exist and the club must be in one of them.
  const inADivision = LEAGUE_ORDER.some((league) =>
    (parsed.divisions?.[league] ?? []).includes(parsed.clubId as string),
  );
  return inADivision;
}

export function loadCareer(): Career | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Career>;
    if (!looksValid(parsed)) return null;
    return {
      ...createCareer(parsed.managerName ?? 'The Gaffer', parsed.clubId),
      ...parsed,
    };
  } catch {
    return null;
  }
}

export function clearCareer(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — a failed clear just leaves the old save in place.
  }
}
