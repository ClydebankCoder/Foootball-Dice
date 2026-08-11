/**
 * Turning a probability and a D100 into a football outcome.
 *
 * The contract the whole game rests on is one line: `roll <= probability`
 * succeeds. The bands below sit *inside* that rule rather than alongside it —
 * a critical success is always a success, a partial success is always a
 * failure — so richer outcomes can be layered on later without the headline
 * rule ever changing under the player.
 */

import type { MatchAction, OutcomeBand, Resolution } from '../types';
import { calculateProbability, type ActionContext } from './probability';
import { rollD100, type Rng } from './random';

export type ActionResolution = Omit<Resolution, 'commentary'>;

export interface ResolveOptions {
  /** Inject a known roll — used by tests and, later, by a trusted server. */
  roll?: number;
  rng?: Rng;
}

/** A roll at or below this fraction of the probability is a *special* success. */
const CRITICAL_SUCCESS_FRACTION = 0.1;
/** Rolls this high are disasters rather than ordinary misses. */
const CRITICAL_FAILURE_THRESHOLD = 96;

export function criticalSuccessThreshold(probability: number): number {
  return Math.max(1, Math.floor(probability * CRITICAL_SUCCESS_FRACTION));
}

/** How far past the probability still counts as "nearly". */
export function partialSuccessThreshold(probability: number): number {
  return probability + Math.max(3, Math.round((100 - probability) * 0.15));
}

export function bandForRoll(probability: number, roll: number): OutcomeBand {
  if (roll <= criticalSuccessThreshold(probability)) return 'critical-success';
  if (roll <= probability) return 'success';
  if (roll >= CRITICAL_FAILURE_THRESHOLD) return 'critical-failure';
  if (roll <= partialSuccessThreshold(probability)) return 'partial-success';
  return 'failure';
}

export function isSuccessBand(band: OutcomeBand): boolean {
  return band === 'critical-success' || band === 'success';
}

/**
 * Resolves an action.
 *
 * The third argument accepts either a bare roll (`resolveAction(a, ctx, 50)`)
 * or an options object, so deterministic tests stay terse.
 */
export function resolveAction(
  action: MatchAction,
  context: ActionContext,
  options: ResolveOptions | number = {},
): ActionResolution {
  const opts: ResolveOptions = typeof options === 'number' ? { roll: options } : options;
  const breakdown = calculateProbability(action, context);
  const probability = breakdown.final;

  const roll = opts.roll ?? rollD100(opts.rng ?? { next: Math.random });
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) {
    throw new Error(`A D100 roll must be an integer from 1 to 100, got ${roll}`);
  }

  const band = bandForRoll(probability, roll);

  return {
    actionId: action.id,
    actionName: action.name,
    probability,
    breakdown,
    roll,
    band,
    success: roll <= probability,
  };
}
