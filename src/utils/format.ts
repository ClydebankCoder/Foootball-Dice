/** Presentation helpers shared across screens. */

import type { OutcomeBand, RiskLevel, SituationId } from '../types';

export type ProbabilityBand = 'safe' | 'balanced' | 'risky' | 'extreme';

/**
 * The band shown next to an action.
 *
 * Derived from the *final* probability rather than the action's inherent risk,
 * because that is the number the manager is actually betting on. The word is
 * always shown with the colour so nothing is communicated by colour alone.
 */
export function probabilityBand(probability: number): ProbabilityBand {
  if (probability >= 75) return 'safe';
  if (probability >= 45) return 'balanced';
  if (probability >= 20) return 'risky';
  return 'extreme';
}

export const BAND_LABELS: Record<ProbabilityBand, string> = {
  safe: 'SAFE',
  balanced: 'BALANCED',
  risky: 'RISKY',
  extreme: 'EXTREME',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  safe: 'Safe',
  balanced: 'Balanced',
  risky: 'Risky',
  extreme: 'Extreme',
};

export const BAND_OUTCOME_LABELS: Record<OutcomeBand, string> = {
  'critical-success': 'PERFECT',
  success: 'SUCCESS',
  'partial-success': 'SO CLOSE',
  failure: 'FAILURE',
  'critical-failure': 'DISASTER',
};

export const SITUATION_KICKER: Record<SituationId, string> = {
  'build-up': '⚽ ATTACKING',
  'counter-attack': '⚡ COUNTER ATTACK',
  'final-third': '⚽ FINAL THIRD',
  'wing-attack': '⚽ WIDE AREAS',
  'box-chance': '🎯 IN THE BOX',
  'one-on-one': '🎯 ONE ON ONE',
  'opposition-counter': '🛡 DEFENDING',
  'defend-through-ball': '🛡 DEFENDING',
  'defend-cross': '🛡 DEFENDING',
  'defend-one-on-one': '🛡 LAST MAN',
};

export function signed(value: number): string {
  return value > 0 ? `+${value}%` : `${value}%`;
}

export function formatMinute(minute: number): string {
  return `${minute}'`;
}

export function percentage(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}
