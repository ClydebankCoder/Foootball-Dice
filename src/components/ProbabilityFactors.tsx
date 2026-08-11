/**
 * The "why is it that number?" panel.
 *
 * Every modifier the engine applied, itemised and adding up to the figure on
 * screen. This is what turns a probability from something the game asserts
 * into something the manager can argue with — and, eventually, into a reason
 * to sign a better passer.
 */

import type { ProbabilityBreakdown } from '../types';
import { signed } from '../utils/format';

interface Props {
  breakdown: ProbabilityBreakdown;
  title?: string;
}

export function ProbabilityFactors({ breakdown, title = 'WHY?' }: Props) {
  return (
    <div className="factors">
      <p className="factors__title">{title}</p>
      <dl className="factors__list">
        <div className="factors__row">
          <dt>Base chance</dt>
          <dd>{breakdown.base}%</dd>
        </div>
        {breakdown.factors.map((factor, index) => (
          <div className="factors__row" key={`${factor.label}-${index}`}>
            <dt>{factor.label}</dt>
            <dd className={factor.value > 0 ? 'is-positive' : 'is-negative'}>
              {signed(factor.value)}
            </dd>
          </div>
        ))}
        <div className="factors__row factors__row--total">
          <dt>Final</dt>
          <dd>{breakdown.final}%</dd>
        </div>
      </dl>
      {breakdown.clamped && (
        <p className="factors__note">
          Capped at {breakdown.final}% — nothing is ever certain, and nothing is ever
          impossible.
        </p>
      )}
    </div>
  );
}
