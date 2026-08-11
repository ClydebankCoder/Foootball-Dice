/**
 * The briefing shown once, when a manager takes their first job.
 *
 * It teaches the one rule the game rests on and then gets out of the way.
 * The example bar is the real `ProbabilityBar` component rather than a picture
 * of one, so what is taught here is exactly what appears in a match.
 */

import { useEffect, useRef } from 'react';
import { ProbabilityBar } from './ProbabilityBar';

interface Props {
  clubName: string;
  onClose: () => void;
}

export function TutorialModal({ clubName, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);

    // Stop the page behind the dialog scrolling on mobile.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <p className="eyebrow">Welcome to {clubName}</p>
          <h2 className="modal__title" id="tutorial-title">
            How this works
          </h2>
        </div>

        {/* Scrolls on short screens so the button below never drops off. */}
        <div className="modal__body">
        <ol className="beats">
          <li className="beat">
            <span className="beat__number">1</span>
            <div className="beat__body">
              <h3 className="beat__title">You see the odds first</h3>
              <p className="beat__text">
                Every action carries its real chance of coming off, worked out from your
                player's attributes, your tactics and who is in the way.
              </p>
              <div className="beat__example">
                <span className="beat__example-name">Through Ball</span>
                <span className="beat__example-pct">64%</span>
              </div>
            </div>
          </li>

          <li className="beat">
            <span className="beat__number">2</span>
            <div className="beat__body">
              <h3 className="beat__title">Then you roll a D100</h3>
              <p className="beat__text">
                A genuine 1–100. Roll <strong>64 or under</strong> and the ball goes
                through. Roll 65 or over and it doesn't. That's the whole game.
              </p>
              <ProbabilityBar probability={64} />
            </div>
          </li>

          <li className="beat">
            <span className="beat__number">3</span>
            <div className="beat__body">
              <h3 className="beat__title">Nothing is off the menu</h3>
              <p className="beat__text">
                A 3% rabona sits on the same list as a 93% short pass. If you fancy it,
                you can try it — and if the dice are kind, it comes off.
              </p>
            </div>
          </li>

          <li className="beat">
            <span className="beat__number">4</span>
            <div className="beat__body">
              <h3 className="beat__title">Success moves you up the pitch</h3>
              <p className="beat__text">
                A through ball that lands turns a 30% shot into a 63% one. The safe pass
                keeps the ball but gets you no closer to goal. That's the decision.
              </p>
            </div>
          </li>
        </ol>

          <p className="modal__note">
            Stuck on a number? Tap <strong>Why?</strong> next to any action to see every
            modifier that built it.
          </p>
        </div>

        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={onClose}
          ref={closeRef}
        >
          Got it — let's play
        </button>
      </div>
    </div>
  );
}
