/**
 * The manager's career: club, tactics, the division they are in, fixtures,
 * results, records and every season they have completed.
 *
 * Persisted to localStorage so a refresh never costs progress. The shape
 * mirrors the planned Supabase tables, so moving to accounts later means
 * changing where this is read from and written to, not what it contains.
 */

import { getClub, startingDivisions } from '../data/clubs';
import { FINAL_ROUND } from '../data/cup';
import { LEAGUE_ORDER } from '../data/leagues';
import {
  advanceRound,
  createCup,
  cupOver,
  recordTieResult,
  simulateRestOfRound,
  tieFor,
} from '../engine/cup';
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
  CompetitionMode,
  CupSeasonRecord,
  CupTie,
  Fixture,
  LeagueId,
  ManagerRecords,
  MatchSummary,
  SeasonRecord,
  SeasonSummary,
  TableRow,
  Tactics,
} from '../types';

/**
 * Bumped to 3 when the Scottish Cup arrived alongside the league. Earlier
 * saves lack a competition and a division table and cannot be migrated
 * meaningfully, so they are discarded rather than half-loaded.
 */
export const CAREER_VERSION = 3;
const STORAGE_KEY = 'football-dice:career';
/** Matches kept in the save. Enough for form; not enough to bloat storage. */
const HISTORY_LIMIT = 40;

export const DEFAULT_TACTICS: Tactics = {
  mentality: 'balanced',
  passing: 'mixed',
  tempo: 'normal',
  pressing: 'medium',
};

export function createCareer(
  managerName: string,
  clubId: string,
  competition: CompetitionMode = 'league',
): Career {
  const divisions = startingDivisions();
  const league = getClub(clubId).league;
  const rng = createRng();

  const career: Career = {
    version: CAREER_VERSION,
    managerName: managerName.trim() || 'The Gaffer',
    clubId,
    competition,
    tutorialSeen: false,
    tactics: { ...DEFAULT_TACTICS },
    season: 1,
    divisions,
    fixtures: competition === 'league' ? generateFixtures(divisions[league]) : [],
    records: {
      lowestSuccessfulProbability: null,
      lowestSuccessfulActionName: null,
      actionsAttempted: 0,
      actionsSuccessful: 0,
    },
    history: [],
    seasons: [],
    pendingSeasonSummary: null,
    cup: competition === 'scottish-cup' ? createCup(1, divisions, rng) : null,
    cupSeasons: [],
  };

  // A top-flight club is not in the preliminary round, so walk the cup on
  // until they actually have a tie to play.
  return competition === 'scottish-cup' ? advanceCupToUserTie(career) : career;
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
 * Folds a match's decisions into the manager's lifetime records, including the
 * longest odds they have ever beaten.
 */
function applyDecisionRecords(
  current: ManagerRecords,
  summary: MatchSummary,
): ManagerRecords {
  const records = { ...current };
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
  return records;
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

  return {
    ...career,
    fixtures,
    records: applyDecisionRecords(career.records, summary),
    history: [...career.history, summary].slice(-HISTORY_LIMIT),
  };
}

/* -------------------------------------------------------------- cup mode */

/** The manager's tie in the current cup round, if they have one. */
export function cupTie(career: Career): CupTie | null {
  if (!career.cup) return null;
  return tieFor(career.cup, career.clubId);
}

export function cupIsOver(career: Career): boolean {
  return career.cup !== null && cupOver(career.cup);
}

/**
 * Walks the cup forward until the manager has a tie in front of them.
 *
 * Rounds they are not involved in — because they have not entered yet — are
 * played out around them, so the bracket they eventually join is real.
 */
export function advanceCupToUserTie(career: Career): Career {
  if (!career.cup || cupOver(career.cup)) return career;

  const rng = createRng();
  let cup = career.cup;

  for (let guard = 0; guard <= FINAL_ROUND + 1; guard++) {
    if (tieFor(cup, career.clubId)) break;

    // Not in this round: settle it and move on.
    cup = simulateRestOfRound(cup, rng);
    if (cup.round >= FINAL_ROUND) {
      cup = advanceRound(cup, career.divisions, rng);
      break;
    }
    cup = advanceRound(cup, career.divisions, rng);
  }

  return { ...career, cup };
}

export interface CupTieResult {
  tieId: string;
  homeScore: number;
  awayScore: number;
  shootout: { home: number; away: number } | null;
  winnerClubId: string;
}

/**
 * Records the manager's cup tie, plays out the rest of the round, and either
 * moves the cup on or ends their run.
 */
export function completeCupTie(
  career: Career,
  result: CupTieResult,
  summary: MatchSummary,
): Career {
  if (!career.cup) return career;
  const rng = createRng();

  let cup = recordTieResult(career.cup, result.tieId, {
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    shootout: result.shootout,
    winnerClubId: result.winnerClubId,
  });
  cup = simulateRestOfRound(cup, rng);

  const knockedOut = result.winnerClubId !== career.clubId;
  if (knockedOut) {
    cup = { ...cup, eliminatedInRound: cup.round };
  } else if (cup.round >= FINAL_ROUND) {
    cup = { ...cup, winnerClubId: career.clubId };
  }

  const records = applyDecisionRecords(career.records, summary);
  let next: Career = {
    ...career,
    cup,
    records,
    history: [...career.history, summary].slice(-HISTORY_LIMIT),
  };

  // Still in it: draw the next round and find their next tie.
  if (!knockedOut && cup.round < FINAL_ROUND) {
    next = { ...next, cup: advanceRound(cup, career.divisions, rng) };
    next = advanceCupToUserTie(next);
  }

  return next;
}

/** Files the cup run and draws a fresh cup for the next season. */
export function startNextCupSeason(career: Career): Career {
  if (!career.cup) return career;
  const rng = createRng();
  const won = career.cup.winnerClubId === career.clubId;
  const roundReached = won
    ? FINAL_ROUND
    : (career.cup.eliminatedInRound ?? career.cup.round);

  const record: CupSeasonRecord = {
    season: career.season,
    roundReached,
    won,
    runnerUp: !won && roundReached === FINAL_ROUND,
  };

  const season = career.season + 1;
  const fresh: Career = {
    ...career,
    season,
    cup: createCup(season, career.divisions, rng),
    cupSeasons: [...career.cupSeasons, record],
    history: [],
  };
  return advanceCupToUserTie(fresh);
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
