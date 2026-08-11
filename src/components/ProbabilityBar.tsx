/**
 * The D100 bar.
 *
 * A literal picture of the roll the manager is about to make: everything from
 * 1 up to the probability succeeds, everything above it fails. When a roll has
 * happened, a marker shows exactly where it landed on that scale.
 */

import { probabilityBand } from '../utils/format';

interface Props {
  probability: number;
  /** Marks where the dice landed, once it has been rolled. */
  roll?: number;
  compact?: boolean;
}

export function ProbabilityBar({ probability, roll, compact = false }: Props) {
  const band = probabilityBand(probability);

  return (
    <div className={`prob-bar ${compact ? 'prob-bar--compact' : ''}`}>
      <div
        className="prob-bar__track"
        role="img"
        aria-label={`Rolls 1 to ${probability} succeed. Rolls ${probability + 1} to 100 fail.${
          roll ? ` This roll was ${roll}.` : ''
        }`}
      >
        <div className={`prob-bar__success band-${band}`} style={{ width: `${probability}%` }} />
        <div className="prob-bar__failure" />
        {roll !== undefined && (
          <div className="prob-bar__marker" style={{ left: `${roll}%` }}>
            <span className="prob-bar__marker-dot" />
          </div>
        )}
      </div>

      {!compact && (
        <div className="prob-bar__scale">
          <span>1</span>
          <span className="prob-bar__zone prob-bar__zone--success">
            SUCCESS 1–{probability}
          </span>
          <span className="prob-bar__zone prob-bar__zone--failure">
            {probability === 99 ? 'FAILURE 100' : `FAILURE ${probability + 1}–100`}
          </span>
          <span>100</span>
        </div>
      )}
    </div>
  );
}
