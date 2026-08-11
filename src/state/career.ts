/**
 * The manager's career: club, tactics, fixtures, results and records.
 *
 * Persisted to localStorage so a refresh never costs progress. The shape
 * mirrors the planned Supabase tables, so moving to accounts later means
 * changing where this is read from and written to, not what it contains.
 */

import { CLUBS } from '../data/clubs';
import {
  computeTable,
  embellishScoreline,
  generateFixtures,
  simulateFixture,
} from '../engine/league';
import { createRng } from '../engine/random';
import type { Career, Fixture, MatchSummary, Tactics, TableRow } from '../types';

export const CAREER_VERSION = 1;
const STORAGE_KEY = 'football-dice:career';

export const DEFAULT_TACTICS: Tactics = {
  mentality: 'balanced',
  passing: 'mixed',
  tempo: 'normal',
  pressing: 'medium',
};

export function leagueClubIds(): string[] {
  return CLUBS.map((club) => club.id);
}

export function createCareer(managerName: string, clubId: string): Career {
  return {
    version: CAREER_VERSION,
    managerName: managerName.trim() || 'The Gaffer',
    clubId,
    tutorialSeen: false,
    tactics: { ...DEFAULT_TACTICS },
    fixtures: generateFixtures(leagueClubIds()),
    records: {
      lowestSuccessfulProbability: null,
      lowestSuccessfulActionName: null,
      actionsAttempted: 0,
      actionsSuccessful: 0,
    },
    history: [],
  };
}

export function tableFor(career: Career): TableRow[] {
  return computeTable(leagueClubIds(), career.fixtures);
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
    history: [...career.history, summary],
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

export function loadCareer(): Career | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Career>;
    if (parsed?.version !== CAREER_VERSION) return null;
    if (!parsed.clubId || !Array.isArray(parsed.fixtures)) return null;
    // Guard against a club that no longer exists in the data set.
    if (!leagueClubIds().includes(parsed.clubId)) return null;
    return {
      ...createCareer(parsed.managerName ?? 'The Gaffer', parsed.clubId),
      ...parsed,
    } as Career;
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
