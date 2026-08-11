import { describe, expect, it } from 'vitest';
import {
  advanceMatch,
  commitAction,
  createMatch,
  getDecisionOptions,
  summariseDecisions,
} from './matchEngine';
import type { MatchState, Tactics } from '../types';
import { createSeededRng } from './random';

const TACTICS: Tactics = {
  mentality: 'balanced',
  passing: 'mixed',
  tempo: 'normal',
  pressing: 'medium',
};

function newMatch(seed: number): MatchState {
  return createMatch({
    fixtureId: 'test-fixture',
    homeClubId: 'greenock-rovers',
    awayClubId: 'inverclyde-fc',
    userClubId: 'greenock-rovers',
    tactics: TACTICS,
    seed,
  });
}

/** Plays a whole match, choosing actions with the supplied strategy. */
function playMatch(
  seed: number,
  choose: (options: ReturnType<typeof getDecisionOptions>, rng: { next(): number }) => string,
): MatchState {
  const rng = createSeededRng(seed + 1);
  let state = advanceMatch(newMatch(seed));
  let guard = 0;

  while (state.phase !== 'full-time') {
    guard += 1;
    if (guard > 500) throw new Error('Match failed to reach full time');

    if (state.phase === 'decision') {
      const options = getDecisionOptions(state);
      expect(options.length).toBeGreaterThan(0);
      state = commitAction(state, choose(options, rng)).state;
    }
    state = advanceMatch(state);
  }
  return state;
}

const safest = (options: ReturnType<typeof getDecisionOptions>) => options[0].action.id;
const wildest = (options: ReturnType<typeof getDecisionOptions>) =>
  options[options.length - 1].action.id;

describe('a full match', () => {
  it('reaches full time from any seed', () => {
    for (const seed of [1, 2, 3, 17, 512, 90210]) {
      const state = playMatch(seed, safest);
      expect(state.phase).toBe('full-time');
      expect(state.minute).toBe(90);
    }
  });

  it('budgets for 8-12 key moments', () => {
    for (const seed of [4, 8, 15, 16, 23, 42]) {
      const state = newMatch(seed);
      expect(state.decisionBudget).toBeGreaterThanOrEqual(8);
      expect(state.decisionBudget).toBeLessThanOrEqual(12);
      expect(state.decisionMinutes.length).toBe(state.decisionBudget);
    }
  });

  it('keeps a whole match to a sitting, chains included', () => {
    // Safe options tend to retain possession and chain into further
    // decisions, so this is the strategy that inflates a match the most.
    for (const seed of [1, 9, 44, 101, 777, 4096]) {
      const state = playMatch(seed, safest);
      expect(state.decisions.length).toBeGreaterThanOrEqual(8);
      expect(state.decisions.length).toBeLessThanOrEqual(16);
    }
  });

  it('schedules those moments in order and inside the ninety', () => {
    for (const seed of [5, 55, 555]) {
      const { decisionMinutes } = newMatch(seed);
      for (let i = 1; i < decisionMinutes.length; i++) {
        expect(decisionMinutes[i]).toBeGreaterThan(decisionMinutes[i - 1]);
      }
      expect(decisionMinutes[0]).toBeGreaterThanOrEqual(2);
      expect(decisionMinutes[decisionMinutes.length - 1]).toBeLessThanOrEqual(89);
    }
  });

  it('records at least one decision per scheduled moment', () => {
    const state = playMatch(31, safest);
    expect(state.decisions.length).toBeGreaterThanOrEqual(state.decisionMinutes.length);
  });

  it('keeps the scoreline consistent with the goals it logged', () => {
    for (const seed of [6, 61, 611, 6111]) {
      const state = playMatch(seed, wildest);
      const home = state.goals.filter((g) => g.teamId === state.homeClubId).length;
      const away = state.goals.filter((g) => g.teamId === state.awayClubId).length;
      expect(state.homeScore).toBe(home);
      expect(state.awayScore).toBe(away);
      expect(state.homeScore).toBeGreaterThanOrEqual(0);
      expect(state.awayScore).toBeGreaterThanOrEqual(0);
    }
  });

  it('produces sane match statistics', () => {
    const state = playMatch(77, safest);
    expect(state.stats.home.possession + state.stats.away.possession).toBe(100);
    expect(state.stats.home.shotsOnTarget).toBeLessThanOrEqual(state.stats.home.shots);
    expect(state.stats.away.shotsOnTarget).toBeLessThanOrEqual(state.stats.away.shots);
    expect(state.stats.home.shots).toBeGreaterThanOrEqual(state.homeScore);
  });

  it('always offers a real choice, never a single forced action', () => {
    const state = playMatch(123, (options) => options[Math.floor(options.length / 2)].action.id);
    expect(state.decisions.length).toBeGreaterThan(0);
  });
});

describe('decisions', () => {
  it('records the probability the manager was shown alongside the roll', () => {
    let state = advanceMatch(newMatch(2024));
    const options = getDecisionOptions(state);
    const shown = options[0];
    const { state: after, resolution } = commitAction(state, shown.action.id, { roll: 50 });

    expect(resolution.probability).toBe(shown.probability);
    expect(resolution.roll).toBe(50);
    expect(resolution.success).toBe(50 <= shown.probability);
    expect(after.decisions[0].probability).toBe(shown.probability);
    expect(after.decisions[0].roll).toBe(50);
    state = after;
    expect(state.phase).toBe('resolved');
  });

  it('honours an injected roll so a 1% action can be forced through', () => {
    const state = advanceMatch(newMatch(4321));
    const options = getDecisionOptions(state);
    const longest = options[options.length - 1];
    const { resolution } = commitAction(state, longest.action.id, { roll: 1 });
    expect(resolution.roll).toBe(1);
    expect(resolution.success).toBe(true);
    expect(resolution.band).toBe('critical-success');
  });

  it('never offers a probability outside 1-99 during play', () => {
    const seen: number[] = [];
    playMatch(888, (options) => {
      for (const option of options) seen.push(option.probability);
      return options[0].action.id;
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...seen)).toBeLessThanOrEqual(99);
  });

  it('refuses to commit when there is nothing to decide', () => {
    const state = newMatch(9);
    expect(() => commitAction(state, 'short-pass')).toThrow();
  });
});

describe('the dice actually matter', () => {
  it('lets the underdog beat the favourite over a run of matches', () => {
    // Clyde Valley have the worst defence in the division; Inverclyde the best.
    let underdogWins = 0;
    for (let seed = 0; seed < 40; seed++) {
      const state = playMatchFor(seed, 'clyde-valley-united', 'inverclyde-fc');
      if (state.homeScore > state.awayScore) underdogWins += 1;
    }
    expect(underdogWins).toBeGreaterThan(0);
  });

  it('does not let the safest option win every time', () => {
    let failures = 0;
    for (let seed = 100; seed < 130; seed++) {
      const state = playMatch(seed, safest);
      failures += state.decisions.filter((d) => !d.success).length;
    }
    expect(failures).toBeGreaterThan(0);
  });
});

function playMatchFor(seed: number, userClubId: string, opponentId: string): MatchState {
  let state = advanceMatch(
    createMatch({
      fixtureId: 'test',
      homeClubId: userClubId,
      awayClubId: opponentId,
      userClubId,
      tactics: TACTICS,
      seed,
    }),
  );
  let guard = 0;
  while (state.phase !== 'full-time') {
    if (++guard > 500) throw new Error('stuck');
    if (state.phase === 'decision') {
      const options = getDecisionOptions(state);
      // Take a middling risk each time.
      state = commitAction(state, options[Math.floor(options.length / 2)].action.id).state;
    }
    state = advanceMatch(state);
  }
  return state;
}

describe('the post-match summary', () => {
  it('counts attempts, successes and the biggest gamble', () => {
    const state = playMatch(2468, wildest);
    const summary = summariseDecisions(state);
    expect(summary.attempted).toBe(state.decisions.length);
    expect(summary.successful).toBe(state.decisions.filter((d) => d.success).length);
    expect(summary.biggestGamble).not.toBeNull();
    const lowest = Math.min(...state.decisions.map((d) => d.probability));
    expect(summary.biggestGamble!.probability).toBe(lowest);
  });
});
