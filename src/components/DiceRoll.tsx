/**
 * The D100 roll.
 *
 * The number shown while rolling is pure theatre — the real roll came out of
 * the engine before this component mounted, and is revealed when the ticker
 * stops. The wait is the point: the manager has already committed and now has
 * to watch it land.
 */

import { useEffect, useRef, useState } from 'react';
import { createRng, rollD100 } from '../engine/random';
import type { OutcomeBand } from '../types';
import { BAND_OUTCOME_LABELS } from '../utils/format';

interface Props {
  /** The real roll from the engine. */
  roll: number;
  probability: number;
  band: OutcomeBand;
  revealed: boolean;
  onRevealed: () => void;
}

const SPIN_MS = 950;
const TICK_MS = 60;

export function DiceRoll({ roll, probability, band, revealed, onRevealed }: Props) {
  const [display, setDisplay] = useState<number>(() => rollD100(createRng()));
  const [spinning, setSpinning] = useState(!revealed);
  const onRevealedRef = useRef(onRevealed);
  onRevealedRef.current = onRevealed;

  useEffect(() => {
    if (revealed) {
      setDisplay(roll);
      setSpinning(false);
      return;
    }

    const rng = createRng();
    setSpinning(true);
    const ticker = window.setInterval(() => setDisplay(rollD100(rng)), TICK_MS);
    const stop = window.setTimeout(() => {
      window.clearInterval(ticker);
      setDisplay(roll);
      setSpinning(false);
      onRevealedRef.current();
    }, SPIN_MS);

    return () => {
      window.clearInterval(ticker);
      window.clearTimeout(stop);
    };
  }, [roll, revealed]);

  const succeeded = band === 'success' || band === 'critical-success';

  return (
    <div className={`dice ${spinning ? 'dice--spinning' : 'dice--landed'}`}>
      <p className="dice__label">{spinning ? '🎲 ROLLING…' : '🎲 D100'}</p>
      <p
        className={`dice__number ${spinning ? '' : succeeded ? 'is-success' : 'is-failure'}`}
        aria-live="polite"
        aria-atomic="true"
      >
        {display}
      </p>

      {!spinning && (
        <div className="dice__verdict">
          <p className="dice__maths">
            Rolled <strong>{roll}</strong> · needed <strong>{probability}</strong> or less
          </p>
          <p className={`dice__result ${succeeded ? 'is-success' : 'is-failure'}`}>
            {BAND_OUTCOME_LABELS[band]}
          </p>
        </div>
      )}
    </div>
  );
}
