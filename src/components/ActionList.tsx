/**
 * The decision menu.
 *
 * Every action available in the situation, sorted by probability, with nothing
 * hidden for being unlikely. The 3% rabona sits on the same list as the 93%
 * short pass, and both are one tap away.
 *
 * "Why?" is a button rather than a hover, so the reasoning behind a number is
 * reachable on a phone.
 */

import { useState } from 'react';
import type { ActionOption } from '../engine/matchEngine';
import { BAND_LABELS, probabilityBand, RISK_LABELS } from '../utils/format';
import { ProbabilityFactors } from './ProbabilityFactors';

interface Props {
  options: ActionOption[];
  onSelect: (actionId: string) => void;
  disabled?: boolean;
}

export function ActionList({ options, onSelect, disabled = false }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="actions">
      {options.map((option) => {
        const band = probabilityBand(option.probability);
        const isOpen = openId === option.action.id;

        return (
          <li className="actions__item" key={option.action.id}>
            <div className="action">
              <button
                type="button"
                className={`action__main band-border-${band}`}
                onClick={() => onSelect(option.action.id)}
                disabled={disabled}
              >
                <span className="action__text">
                  <span className="action__name">{option.action.name}</span>
                  <span className="action__blurb">{option.action.blurb}</span>
                </span>
                <span className="action__odds">
                  <span className={`action__pct band-text-${band}`}>
                    {option.probability}%
                  </span>
                  <span className={`action__band band-chip-${band}`}>
                    {BAND_LABELS[band]}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="action__why"
                aria-expanded={isOpen}
                aria-label={`Why is ${option.action.name} ${option.probability}%?`}
                onClick={() => setOpenId(isOpen ? null : option.action.id)}
              >
                {isOpen ? '×' : 'Why?'}
              </button>
            </div>

            {isOpen && (
              <div className="action__detail">
                <p className="action__risk">
                  Risk profile: {RISK_LABELS[option.action.riskLevel]}
                </p>
                <ProbabilityFactors breakdown={option.breakdown} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
