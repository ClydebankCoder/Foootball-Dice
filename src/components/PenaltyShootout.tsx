/**
 * The shootout screen.
 *
 * Deliberately the same sequence as every other decision — see the odds,
 * commit, lock, roll, live with it — because a penalty is not a different
 * game, it is the same game with the whole cup on one number.
 */

import { useMemo, useState } from 'react';
import { getClub } from '../data/clubs';
import {
  actorFor,
  penaltyOptions,
  roleFor,
  takePenalty,
  type PenaltyOption,
  type PenaltyResult,
} from '../engine/shootout';
import type { ShootoutState } from '../types';
import { probabilityBand } from '../utils/format';
import { DiceRoll } from './DiceRoll';
import { ProbabilityBar } from './ProbabilityBar';
import { ProbabilityFactors } from './ProbabilityFactors';

type Stage = 'choosing' | 'locked' | 'rolling' | 'revealed';

interface Props {
  shootout: ShootoutState;
  onUpdate: (next: ShootoutState) => void;
}

export function PenaltyShootout({ shootout, onUpdate }: Props) {
  const [stage, setStage] = useState<Stage>('choosing');
  const [selected, setSelected] = useState<PenaltyOption | null>(null);
  const [pending, setPending] = useState<PenaltyResult | null>(null);

  const role = roleFor(shootout);
  const options = useMemo(
    () => (shootout.complete ? [] : penaltyOptions(shootout)),
    [shootout],
  );
  const taker = useMemo(
    () => (shootout.complete ? null : actorFor(shootout)),
    [shootout],
  );

  const home = getClub(shootout.homeClubId);
  const away = getClub(shootout.awayClubId);

  function roll() {
    if (!selected) return;
    setPending(takePenalty(shootout, selected.action.id));
    setStage('rolling');
  }

  function reveal() {
    if (!pending) return;
    onUpdate(pending.state);
    setStage('revealed');
  }

  function next() {
    setPending(null);
    setSelected(null);
    setStage('choosing');
  }

  return (
    <div className="shootout">
      <header className="card shootout__board">
        <p className="eyebrow">Penalties</p>
        <p className="shootout__score">
          <span>{home.abbreviation}</span>
          <strong>
            {shootout.homeScore} – {shootout.awayScore}
          </strong>
          <span>{away.abbreviation}</span>
        </p>
        <KickTrack shootout={shootout} clubId={shootout.homeClubId} label={home.shortName} />
        <KickTrack shootout={shootout} clubId={shootout.awayClubId} label={away.shortName} />
        {shootout.suddenDeath && !shootout.complete && (
          <p className="shootout__sudden">SUDDEN DEATH</p>
        )}
      </header>

      {!shootout.complete && stage === 'choosing' && (
        <section className="card">
          <p className="eyebrow">
            {shootout.suddenDeath ? 'Sudden death' : `Kick ${shootout.kickNumber} of 5`}
          </p>
          <h2 className="card__title">
            {role === 'taking'
              ? `${taker?.name} steps up`
              : `${taker?.name} has to keep this one out`}
          </h2>

          {role === 'saving' && shootout.tell && (
            <p className="shootout__tell">
              <span aria-hidden="true">👁</span>
              <span>{shootout.tell.text}</span>
            </p>
          )}

          <ul className="actions">
            {options.map((option) => {
              const band = probabilityBand(option.probability);
              return (
                <li className="actions__item" key={option.action.id}>
                  <button
                    type="button"
                    className={`action__main band-border-${band}`}
                    onClick={() => {
                      setSelected(option);
                      setStage('locked');
                    }}
                  >
                    <span className="action__text">
                      <span className="action__name">{option.action.name}</span>
                      <span className="action__blurb">{option.action.blurb}</span>
                    </span>
                    <span className="action__odds">
                      <span className={`action__pct band-text-${band}`}>
                        {option.probability}%
                      </span>
                      <span className="action__band">
                        {role === 'taking' ? 'TO SCORE' : 'TO SAVE'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {stage === 'locked' && selected && (
        <section className="card card--locked">
          <p className="eyebrow">Locked in</p>
          <h2 className="locked__name">{selected.action.name}</h2>
          <p className={`locked__pct band-text-${probabilityBand(selected.probability)}`}>
            {selected.probability}%
          </p>
          <p className="muted small">
            {role === 'taking' ? 'chance to score' : 'chance to save it'}
          </p>
          <ProbabilityBar probability={selected.probability} />
          <ProbabilityFactors breakdown={selected.breakdown} />
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setSelected(null);
                setStage('choosing');
              }}
            >
              Back
            </button>
            <button type="button" className="btn btn--primary btn--roll" onClick={roll} autoFocus>
              Roll 🎲
            </button>
          </div>
        </section>
      )}

      {(stage === 'rolling' || stage === 'revealed') && pending && selected && (
        <section className="card card--roll">
          <p className="eyebrow">{selected.action.name}</p>
          <DiceRoll
            roll={pending.roll}
            probability={pending.probability}
            band={pending.band}
            revealed={stage === 'revealed'}
            onRevealed={reveal}
          />
          <ProbabilityBar
            probability={pending.probability}
            roll={stage === 'revealed' ? pending.roll : undefined}
          />
          {stage === 'revealed' && (
            <>
              <p className="outcome__commentary">{pending.kick.commentary}</p>
              {!pending.state.complete && (
                <button type="button" className="btn btn--primary btn--block" onClick={next} autoFocus>
                  Next kick
                </button>
              )}
            </>
          )}
        </section>
      )}

      {shootout.kicks.length > 0 && (
        <section className="card">
          <h2 className="card__title">Every kick</h2>
          <ul className="kick-list">
            {[...shootout.kicks].reverse().map((kick, index) => (
              <li className="kick" key={`${kick.playerName}-${index}`}>
                <span className={`kick__mark ${kick.scored ? 'is-scored' : 'is-missed'}`}>
                  {kick.scored ? '●' : '○'}
                </span>
                <span className="kick__club">{getClub(kick.clubId).abbreviation}</span>
                <span className="kick__player">{kick.playerName}</span>
                <span className="kick__odds">
                  {kick.role === 'taking'
                    ? `${kick.actionName} · ${kick.probability}% to score`
                    : `You went ${kick.actionName.toLowerCase()} · ${kick.probability}% to save`}{' '}
                  · rolled {kick.roll}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** A row of dots: filled for scored, hollow for missed. */
function KickTrack({
  shootout,
  clubId,
  label,
}: {
  shootout: ShootoutState;
  clubId: string;
  label: string;
}) {
  const kicks = shootout.kicks.filter((kick) => kick.clubId === clubId);
  return (
    <div className="kick-track">
      <span className="kick-track__label">{label}</span>
      <span className="kick-track__dots">
        {kicks.map((kick, index) => (
          <span
            key={index}
            className={`kick-track__dot ${kick.scored ? 'is-scored' : 'is-missed'}`}
            title={`${kick.probability}%, rolled ${kick.roll}`}
          />
        ))}
        {Array.from({ length: Math.max(0, 5 - kicks.length) }).map((_, index) => (
          <span key={`empty-${index}`} className="kick-track__dot is-pending" />
        ))}
      </span>
    </div>
  );
}
