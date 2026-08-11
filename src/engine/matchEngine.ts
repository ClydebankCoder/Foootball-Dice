/**
 * The match engine.
 *
 * Pure state in, pure state out — no React, no DOM, no timers. The UI decides
 * when to call `advanceMatch` and `commitAction`; everything about what
 * actually happens on the pitch is decided here, and every decision the
 * manager makes leaves an auditable record of probability and roll behind it.
 */

import { getClubWithSquad } from '../data/world';
import type {
  ClubWithSquad,
  MatchAction,
  MatchEvent,
  MatchLogEntry,
  MatchState,
  MatchSummary,
  Player,
  Position,
  ProbabilityBreakdown,
  Resolution,
  SituationId,
  Tactics,
  TeamMatchStats,
} from '../types';
import { getAction, getActionsForSituation, intentFor } from './actions';
import {
  concededCall,
  describeOutcome,
  describeSituation,
  goalCall,
  quietPeriod,
  type CommentaryNames,
} from './commentary';
import { calculateProbability, clampProbability, type ActionContext } from './probability';
import { createSeededRng, pick, randomInt, randomSeed, rollD100, type Rng } from './random';
import { resolveAction } from './resolve';
import {
  ATTACKING_SITUATIONS,
  DEFENSIVE_ESCALATION,
  DEFENSIVE_SITUATIONS,
  getSituation,
} from './situations';

/** How many decisions one passage of play can run to before it fizzles out. */
const MAX_SEQUENCE_STEPS = 3;
const FULL_TIME = 90;
/** Longest stretch of football simulated in one go between key moments. */
const SIM_CHUNK_MINUTES = 10;

/* -------------------------------------------------------------- rng plumbing */

interface Draws {
  rng: Rng;
  used: () => number;
}

/**
 * Rebuilds the match RNG at its current position. Storing a cursor instead of
 * a live generator keeps `MatchState` plain JSON, which is what lets a match
 * survive a page refresh.
 */
function draws(state: MatchState): Draws {
  const base = createSeededRng(state.seed);
  for (let i = 0; i < state.rngCursor; i++) base.next();
  let used = 0;
  return {
    rng: { next: () => (used++, base.next()) },
    used: () => used,
  };
}

/* ------------------------------------------------------------------ helpers */

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function emptyStats(): TeamMatchStats {
  return {
    shots: 0,
    shotsOnTarget: 0,
    possession: 50,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
  };
}

export function userIsHome(state: MatchState): boolean {
  return state.userClubId === state.homeClubId;
}

function userKey(state: MatchState): 'home' | 'away' {
  return userIsHome(state) ? 'home' : 'away';
}

function oppositionKey(state: MatchState): 'home' | 'away' {
  return userIsHome(state) ? 'away' : 'home';
}

export function oppositionClubId(state: MatchState): string {
  return userIsHome(state) ? state.awayClubId : state.homeClubId;
}

function log(
  state: MatchState,
  kind: MatchLogEntry['kind'],
  text: string,
  resolution?: Resolution,
): void {
  state.log.push({ id: nextId('log'), minute: state.minute, kind, text, resolution });
}

function clone(state: MatchState): MatchState {
  return {
    ...state,
    stats: { home: { ...state.stats.home }, away: { ...state.stats.away } },
    log: [...state.log],
    decisions: [...state.decisions],
    goals: [...state.goals],
    decisionMinutes: [...state.decisionMinutes],
  };
}

function choosePlayer(club: ClubWithSquad, positions: Position[], rng: Rng): Player {
  const candidates = club.players
    .filter((p) => positions.includes(p.position))
    .sort((a, b) => b.overall - a.overall);
  if (candidates.length === 0) return club.players[0];
  // The better players are on the pitch more often, but not exclusively.
  return pick(rng, candidates.slice(0, Math.min(4, candidates.length)));
}

function goalkeeperOf(club: ClubWithSquad): Player {
  const keepers = club.players.filter((p) => p.position === 'GK');
  return keepers.sort((a, b) => b.overall - a.overall)[0] ?? club.players[0];
}

function namesFor(
  actor: Player,
  opponent: Player,
  keeper: Player,
): CommentaryNames {
  return { actor: actor.name, opponent: opponent.name, keeper: keeper.name };
}

/* ------------------------------------------------------------ match creation */

export interface MatchSetup {
  fixtureId: string;
  homeClubId: string;
  awayClubId: string;
  userClubId: string;
  tactics: Tactics;
  seed?: number;
}

/** Key moments, spread evenly across the ninety minutes. */
function planDecisionMinutes(rng: Rng, count: number): number[] {
  const segment = (FULL_TIME - 6) / count;
  const minutes: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = 3 + i * segment;
    const minute = Math.round(start + rng.next() * (segment - 1));
    minutes.push(Math.min(89, Math.max(minutes.length ? minutes[minutes.length - 1] + 1 : 2, minute)));
  }
  return minutes;
}

export function createMatch(setup: MatchSetup): MatchState {
  const seed = setup.seed ?? randomSeed();
  const rng = createSeededRng(seed);
  const decisionBudget = randomInt(rng, 8, 12);
  const decisionMinutes = planDecisionMinutes(rng, decisionBudget);

  const state: MatchState = {
    id: nextId('match'),
    seed,
    fixtureId: setup.fixtureId,
    homeClubId: setup.homeClubId,
    awayClubId: setup.awayClubId,
    userClubId: setup.userClubId,
    tactics: setup.tactics,
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    phase: 'kick-off',
    stats: { home: emptyStats(), away: emptyStats() },
    log: [],
    decisions: [],
    goals: [],
    currentEvent: null,
    lastResolution: null,
    // createMatch consumed draws from the same seeded stream: one for the
    // budget, then one per scheduled minute.
    rngCursor: decisionMinutes.length + 1,
    decisionMinutes,
    decisionBudget,
    momentsStarted: 0,
    pendingSituation: null,
    sequenceStep: 0,
  };

  log(state, 'period', 'Kick-off.');
  return state;
}

/* ------------------------------------------------------- background football */

function scoreGoal(state: MatchState, scoringClubId: string, scorer: Player, extra?: {
  probability?: number;
  roll?: number;
}): void {
  const isHomeTeam = scoringClubId === state.homeClubId;
  if (isHomeTeam) state.homeScore += 1;
  else state.awayScore += 1;

  state.goals.push({
    minute: state.minute,
    teamId: scoringClubId,
    scorerId: scorer.id,
    scorerName: scorer.name,
    probability: extra?.probability,
    roll: extra?.roll,
  });
}

/**
 * Football that happens without the manager: the periods between key moments
 * still produce chances, so the scoreline is never purely a function of the
 * decisions the player was offered.
 */
function simulateUntil(state: MatchState, targetMinute: number, rng: Rng): void {
  // Long stretches are simulated in chunks so skipping ahead still produces
  // football rather than one silent leap to full time.
  while (state.minute < targetMinute) {
    const to = Math.min(targetMinute, state.minute + SIM_CHUNK_MINUTES);
    simulateChunk(state, to, rng);
  }
  state.minute = Math.max(state.minute, targetMinute);
}

function simulateChunk(state: MatchState, targetMinute: number, rng: Rng): void {
  const gap = targetMinute - state.minute;
  if (gap <= 0) return;

  state.minute = targetMinute;

  if (gap >= 5 && rollD100(rng) <= 22) {
    // A chance falls to one side or the other, weighted by attacking quality.
    const user = getClubWithSquad(state.userClubId);
    const opposition = getClubWithSquad(oppositionClubId(state));
    const userShare = 50 + (user.ratings.attack - opposition.ratings.attack) * 0.8;
    const userGetsIt = rollD100(rng) <= clampProbability(userShare);

    const attacking = userGetsIt ? user : opposition;
    const defending = userGetsIt ? opposition : user;
    const shooter = choosePlayer(attacking, ['ATT', 'MID'], rng);
    const keeper = goalkeeperOf(defending);

    const quality = clampProbability(
      24 +
        (attacking.ratings.attack -
          (defending.ratings.defence * 0.6 + defending.ratings.goalkeeper * 0.4)) *
          1.1,
    );
    const roll = rollD100(rng);
    const teamKey = attacking.id === state.homeClubId ? 'home' : 'away';
    state.stats[teamKey].shots += 1;

    if (roll <= quality) {
      state.stats[teamKey].shotsOnTarget += 1;
      scoreGoal(state, attacking.id, shooter);
      log(
        state,
        userGetsIt ? 'goal' : 'conceded',
        userGetsIt
          ? `${goalCall(rng)} ${shooter.name} finishes off a move you were not part of.`
          : `${concededCall(rng)} ${shooter.name} punishes a lapse while your back was turned.`,
      );
    } else if (roll <= quality + 20) {
      state.stats[teamKey].shotsOnTarget += 1;
      log(state, 'save', `${shooter.name} forces a save from ${keeper.name}.`);
    } else {
      log(state, 'info', `${shooter.name} has a go from distance and misses the target.`);
    }
  } else if (gap >= 4) {
    log(state, 'period', quietPeriod(rng));
  }
}

function finalisePossession(state: MatchState): void {
  const user = getClubWithSquad(state.userClubId);
  const opposition = getClubWithSquad(oppositionClubId(state));
  const tempoShift =
    state.tactics.tempo === 'slow' ? 4 : state.tactics.tempo === 'fast' ? -3 : 0;
  const passingShift = state.tactics.passing === 'short' ? 3 : state.tactics.passing === 'direct' ? -4 : 0;
  const userPossession = Math.min(
    72,
    Math.max(
      28,
      Math.round(50 + (user.ratings.midfield - opposition.ratings.midfield) * 0.7 + tempoShift + passingShift),
    ),
  );
  state.stats[userKey(state)].possession = userPossession;
  state.stats[oppositionKey(state)].possession = 100 - userPossession;
}

/* ---------------------------------------------------------- event generation */

function opponentPositionsFor(side: 'attack' | 'defence'): Position[] {
  return side === 'attack' ? ['DEF'] : ['ATT', 'MID'];
}

function buildEvent(state: MatchState, situationId: SituationId, rng: Rng): MatchEvent {
  const situation = getSituation(situationId);
  const user = getClubWithSquad(state.userClubId);
  const opposition = getClubWithSquad(oppositionClubId(state));

  const actor = choosePlayer(user, situation.actorPositions, rng);
  const opponent = choosePlayer(opposition, opponentPositionsFor(situation.side), rng);
  const keeper = goalkeeperOf(situation.side === 'attack' ? opposition : user);

  return {
    id: nextId('event'),
    minute: state.minute,
    situation: situationId,
    side: situation.side,
    possessionTeamId: situation.side === 'attack' ? user.id : opposition.id,
    actorId: actor.id,
    opponentId: opponent.id,
    narrative: describeSituation(
      pick(rng, situation.descriptions),
      namesFor(actor, opponent, keeper),
    ),
    sequenceStep: state.sequenceStep + 1,
  };
}

/** Which way the next key moment falls, weighted by how good each side is. */
function chooseSide(state: MatchState, rng: Rng): 'attack' | 'defence' {
  const user = getClubWithSquad(state.userClubId);
  const opposition = getClubWithSquad(oppositionClubId(state));
  const attackingShare = clampProbability(
    52 + (user.ratings.overall - opposition.ratings.overall) * 0.9,
  );
  return rollD100(rng) <= attackingShare ? 'attack' : 'defence';
}

/**
 * Moves the match on to the next thing that needs the manager, or to full time.
 * Safe to call from 'kick-off' and 'resolved'.
 */
export function advanceMatch(state: MatchState): MatchState {
  if (state.phase === 'full-time') return state;

  const next = clone(state);
  const { rng, used } = draws(next);

  next.lastResolution = null;

  // Mid-sequence: the passage of play continues without a break in time.
  if (next.pendingSituation) {
    const situationId = next.pendingSituation;
    next.pendingSituation = null;
    next.currentEvent = buildEvent(next, situationId, rng);
    next.phase = 'decision';
    log(next, 'chance', next.currentEvent.narrative);
    next.rngCursor += used();
    return next;
  }

  next.sequenceStep = 0;

  // Stop once the schedule runs out or the manager has had their say — a
  // passage of play can chain several decisions, and the budget is what keeps
  // a match to eight-to-twelve of them rather than thirty.
  const budgetSpent = next.decisions.length >= next.decisionBudget;
  if (next.momentsStarted >= next.decisionMinutes.length || budgetSpent) {
    simulateUntil(next, FULL_TIME, rng);
    finalisePossession(next);
    next.phase = 'full-time';
    next.currentEvent = null;
    log(next, 'period', `Full time. ${next.homeScore}–${next.awayScore}.`);
    next.rngCursor += used();
    return next;
  }

  const targetMinute = next.decisionMinutes[next.momentsStarted];
  next.momentsStarted += 1;
  simulateUntil(next, targetMinute, rng);

  const side = chooseSide(next, rng);
  const situationId = pick(
    rng,
    side === 'attack' ? ATTACKING_SITUATIONS : DEFENSIVE_SITUATIONS,
  );
  next.currentEvent = buildEvent(next, situationId, rng);
  next.phase = 'decision';
  log(next, 'chance', next.currentEvent.narrative);

  next.rngCursor += used();
  return next;
}

/* ---------------------------------------------------------------- decisions */

export interface ActionOption {
  action: MatchAction;
  breakdown: ProbabilityBreakdown;
  probability: number;
}

function playerById(club: ClubWithSquad, id: string): Player {
  return club.players.find((p) => p.id === id) ?? club.players[0];
}

export function contextForEvent(state: MatchState, event: MatchEvent): ActionContext {
  const user = getClubWithSquad(state.userClubId);
  const opposition = getClubWithSquad(oppositionClubId(state));
  return {
    actor: playerById(user, event.actorId),
    opposition: opposition.ratings,
    tactics: state.tactics,
    situation: getSituation(event.situation),
    isHome: userIsHome(state),
    minute: state.minute,
  };
}

/**
 * Every action available in the current situation, with its full probability
 * breakdown. Nothing is filtered: a 1% option is returned exactly like a 95%
 * one, and it is the UI's job to show both.
 */
export function getDecisionOptions(state: MatchState): ActionOption[] {
  if (!state.currentEvent) return [];
  const context = contextForEvent(state, state.currentEvent);
  return getActionsForSituation(state.currentEvent.situation)
    .map((action) => {
      const breakdown = calculateProbability(action, context);
      return { action, breakdown, probability: breakdown.final };
    })
    .sort((a, b) => b.probability - a.probability);
}

export interface CommitResult {
  state: MatchState;
  resolution: Resolution;
}

function endSequence(state: MatchState): void {
  state.pendingSituation = null;
  state.sequenceStep = 0;
}

function continueSequence(state: MatchState, situation: SituationId): void {
  if (state.sequenceStep + 1 >= MAX_SEQUENCE_STEPS) {
    endSequence(state);
    log(state, 'info', 'The move runs out of steam and the ball is worked back.');
    return;
  }
  state.sequenceStep += 1;
  state.pendingSituation = situation;
}

/**
 * Commits the manager to an action and rolls for it.
 *
 * `roll` can be supplied to replay or test a specific number; otherwise the
 * match RNG produces a genuine 1–100.
 */
export function commitAction(
  state: MatchState,
  actionId: string,
  options: { roll?: number } = {},
): CommitResult {
  if (state.phase !== 'decision' || !state.currentEvent) {
    throw new Error('There is no decision to commit to right now.');
  }

  const next = clone(state);
  const { rng, used } = draws(next);
  const event = next.currentEvent!;
  const action = getAction(actionId);
  const situationId = event.situation;
  const intent = intentFor(action, situationId);

  const user = getClubWithSquad(next.userClubId);
  const opposition = getClubWithSquad(oppositionClubId(next));
  const actor = playerById(user, event.actorId);
  const opponent = playerById(opposition, event.opponentId);
  const keeper = goalkeeperOf(event.side === 'attack' ? opposition : user);

  const context = contextForEvent(next, event);
  const outcome = resolveAction(action, context, {
    ...(options.roll !== undefined ? { roll: options.roll } : {}),
    rng,
  });

  const resolution: Resolution = {
    ...outcome,
    commentary: describeOutcome(
      action,
      outcome.band,
      outcome.probability,
      namesFor(actor, opponent, keeper),
      rng,
    ),
  };

  const us = userKey(next);
  const them = oppositionKey(next);
  let ledToGoal = false;

  if (event.side === 'attack') {
    if (intent.kind === 'shot') {
      next.stats[us].shots += 1;
      if (outcome.success) {
        next.stats[us].shotsOnTarget += 1;
        scoreGoal(next, user.id, actor, {
          probability: outcome.probability,
          roll: outcome.roll,
        });
        ledToGoal = true;
        log(next, 'goal', `${goalCall(rng)} ${resolution.commentary}`, resolution);
      } else {
        if (outcome.band === 'partial-success') next.stats[us].shotsOnTarget += 1;
        log(next, outcome.band === 'partial-success' ? 'save' : 'info', resolution.commentary, resolution);
      }
      endSequence(next);
    } else if (outcome.success) {
      // Advancing moves the ball on; retaining keeps the play where it is.
      const nextSituation =
        intent.kind === 'advance'
          ? intent.next
          : intent.kind === 'retain'
            ? (intent.next ?? situationId)
            : situationId;
      log(next, 'decision', resolution.commentary, resolution);
      continueSequence(next, nextSituation);
    } else {
      log(next, 'decision', resolution.commentary, resolution);
      endSequence(next);
    }
  } else {
    // Defensive moment: success buys safety, failure invites them closer.
    if (action.commitsFoul && outcome.success) {
      next.stats[us].fouls += 1;
      if (rollD100(rng) <= 30) {
        next.stats[us].yellowCards += 1;
        log(next, 'info', `${actor.name} is booked for it. Worth it.`);
      }
    }

    if (outcome.success) {
      log(next, 'decision', resolution.commentary, resolution);
      if (intent.kind === 'delay') {
        continueSequence(next, intent.next);
      } else {
        endSequence(next);
      }
    } else {
      log(next, 'decision', resolution.commentary, resolution);
      const escalation = DEFENSIVE_ESCALATION[situationId] ?? 'concede';
      const outOfRoad = next.sequenceStep + 1 >= MAX_SEQUENCE_STEPS;

      if (escalation === 'concede' || outOfRoad) {
        const scorer = choosePlayer(opposition, ['ATT'], rng);
        next.stats[them].shots += 1;
        next.stats[them].shotsOnTarget += 1;
        scoreGoal(next, opposition.id, scorer);
        log(next, 'conceded', `${concededCall(rng)} ${scorer.name} makes you pay.`);
        endSequence(next);
      } else {
        continueSequence(next, escalation);
      }
    }
  }

  next.decisions.push({
    minute: next.minute,
    situation: situationId,
    side: event.side,
    actionId: action.id,
    actionName: action.name,
    riskLevel: action.riskLevel,
    probability: outcome.probability,
    roll: outcome.roll,
    band: outcome.band,
    success: outcome.success,
    ledToGoal,
  });

  next.lastResolution = resolution;
  next.phase = 'resolved';
  next.rngCursor += used();

  return { state: next, resolution };
}

/* --------------------------------------------------------------- match end */

export function summariseMatch(state: MatchState): MatchSummary {
  return {
    fixtureId: state.fixtureId,
    homeClubId: state.homeClubId,
    awayClubId: state.awayClubId,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    goals: state.goals,
    stats: state.stats,
    decisions: state.decisions,
  };
}

export interface DecisionSummary {
  attempted: number;
  successful: number;
  successRate: number;
  biggestGamble: { actionName: string; probability: number; success: boolean } | null;
}

export function summariseDecisions(state: MatchState): DecisionSummary {
  const attempted = state.decisions.length;
  const successful = state.decisions.filter((d) => d.success).length;
  const biggest = [...state.decisions].sort((a, b) => a.probability - b.probability)[0];
  return {
    attempted,
    successful,
    successRate: attempted === 0 ? 0 : (successful / attempted) * 100,
    biggestGamble: biggest
      ? {
          actionName: biggest.actionName,
          probability: biggest.probability,
          success: biggest.success,
        }
      : null,
  };
}
