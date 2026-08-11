import { describe, expect, it } from 'vitest';
import { bandForRoll, isSuccessBand, resolveAction } from './resolve';
import { clampProbability } from './probability';
import type { MatchAction, Player, Tactics } from '../types';
import { getSituation } from './situations';
import type { ActionContext } from './probability';

/**
 * A player and context engineered so that every modifier cancels out. That
 * lets these tests assert on the one rule the whole game depends on —
 * `roll <= probability` succeeds — without a rating quietly shifting it.
 */
function neutralPlayer(): Player {
  const attributes = {
    pace: 50, shooting: 50, passing: 50, vision: 50, technique: 50,
    strength: 50, defending: 50, positioning: 50, composure: 50,
    stamina: 50, flair: 50, reflexes: 50, handling: 50,
    distribution: 50, oneOnOnes: 50,
  };
  return {
    id: 'test-player',
    clubId: 'test-club',
    name: 'Test Player',
    age: 25,
    position: 'MID',
    squadNumber: 8,
    attributes,
    overall: 50,
    fitness: 100,
  };
}

const NEUTRAL_TACTICS: Tactics = {
  mentality: 'balanced',
  passing: 'mixed',
  tempo: 'normal',
  pressing: 'medium',
};

/** A situation with no pressure, so the base probability survives untouched. */
function neutralContext(): ActionContext {
  return {
    actor: neutralPlayer(),
    opposition: { attack: 50, midfield: 50, defence: 50, goalkeeper: 50, overall: 50 },
    tactics: NEUTRAL_TACTICS,
    situation: { ...getSituation('build-up'), pressure: 0 },
    isHome: false,
    minute: 20,
  };
}

/**
 * Builds an action whose final probability lands exactly on `probability`.
 * The away-from-home modifier is the only one left in play, so the base
 * compensates for it.
 */
function actionWithProbability(probability: number): MatchAction {
  return {
    id: 'test-action',
    name: 'Test Action',
    category: 'pass',
    situations: ['build-up'],
    baseProbability: probability + 2, // offsets the -2 "away from home"
    attributeWeights: {},
    opposedBy: {},
    riskLevel: 'balanced',
    intent: { kind: 'retain' },
    blurb: 'For testing only.',
  };
}

describe('the D100 contract', () => {
  it('sets the probability the test asked for', () => {
    for (const probability of [1, 25, 50, 74, 99]) {
      const resolution = resolveAction(actionWithProbability(probability), neutralContext(), 50);
      expect(resolution.probability).toBe(probability);
    }
  });

  it('succeeds on a 1% action with a roll of 1', () => {
    const result = resolveAction(actionWithProbability(1), neutralContext(), 1);
    expect(result.probability).toBe(1);
    expect(result.success).toBe(true);
  });

  it('fails a 1% action on a roll of 2', () => {
    const result = resolveAction(actionWithProbability(1), neutralContext(), 2);
    expect(result.success).toBe(false);
  });

  it('succeeds a 50% action on exactly 50', () => {
    expect(resolveAction(actionWithProbability(50), neutralContext(), 50).success).toBe(true);
  });

  it('fails a 50% action on 51', () => {
    expect(resolveAction(actionWithProbability(50), neutralContext(), 51).success).toBe(false);
  });

  it('succeeds a 99% action on 99', () => {
    expect(resolveAction(actionWithProbability(99), neutralContext(), 99).success).toBe(true);
  });

  it('fails a 99% action on 100', () => {
    expect(resolveAction(actionWithProbability(99), neutralContext(), 100).success).toBe(false);
  });

  it('holds roll <= probability at every single boundary', () => {
    for (let probability = 1; probability <= 99; probability++) {
      const action = actionWithProbability(probability);
      for (let roll = 1; roll <= 100; roll++) {
        const result = resolveAction(action, neutralContext(), roll);
        expect(result.success).toBe(roll <= probability);
      }
    }
  });

  it('rejects rolls outside 1-100', () => {
    const action = actionWithProbability(50);
    expect(() => resolveAction(action, neutralContext(), 0)).toThrow();
    expect(() => resolveAction(action, neutralContext(), 101)).toThrow();
    expect(() => resolveAction(action, neutralContext(), 50.5)).toThrow();
  });
});

describe('outcome bands', () => {
  it('never contradicts the success rule', () => {
    for (let probability = 1; probability <= 99; probability++) {
      for (let roll = 1; roll <= 100; roll++) {
        expect(isSuccessBand(bandForRoll(probability, roll))).toBe(roll <= probability);
      }
    }
  });

  it('treats a very low roll as a critical success', () => {
    expect(bandForRoll(80, 1)).toBe('critical-success');
    expect(bandForRoll(80, 8)).toBe('critical-success');
    expect(bandForRoll(80, 9)).toBe('success');
  });

  it('treats a near miss as a partial success', () => {
    expect(bandForRoll(60, 61)).toBe('partial-success');
    expect(bandForRoll(60, 66)).toBe('partial-success');
    expect(bandForRoll(60, 67)).toBe('failure');
  });

  it('treats the worst rolls as critical failures', () => {
    expect(bandForRoll(50, 96)).toBe('critical-failure');
    expect(bandForRoll(50, 100)).toBe('critical-failure');
  });

  it('lets a 1% action roll a critical success', () => {
    expect(bandForRoll(1, 1)).toBe('critical-success');
  });
});

describe('probability clamping', () => {
  it('never returns 0% or 100%', () => {
    expect(clampProbability(-40)).toBe(1);
    expect(clampProbability(0)).toBe(1);
    expect(clampProbability(100)).toBe(99);
    expect(clampProbability(160)).toBe(99);
  });
});
