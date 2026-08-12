/**
 * The match.
 *
 * The sequence is deliberate and always the same:
 *
 *   see the odds → commit → odds lock → roll the D100 → see the number →
 *   read what happened → carry on
 *
 * The engine decides the roll the moment the manager commits; the animation
 * only delays telling them. That ordering matters — nothing is chosen after
 * the fact to make a better story.
 */

import { useMemo, useState } from 'react';
import { ActionList } from '../components/ActionList';
import { DiceRoll } from '../components/DiceRoll';
import { MatchTimeline } from '../components/MatchTimeline';
import { PenaltyShootout } from '../components/PenaltyShootout';
import { ProbabilityBar } from '../components/ProbabilityBar';
import { ProbabilityFactors } from '../components/ProbabilityFactors';
import { Scoreboard } from '../components/Scoreboard';
import {
  advanceMatch,
  commitAction,
  getDecisionOptions,
  oppositionClubId,
  type ActionOption,
  type CommitResult,
} from '../engine/matchEngine';
import { getClub } from '../data/clubs';
import { getClubWithSquad } from '../data/world';
import type { MatchState } from '../types';
import { probabilityBand, signed, SITUATION_KICKER } from '../utils/format';

type Stage = 'choosing' | 'locked' | 'rolling' | 'revealed';

interface Props {
  initialState: MatchState;
  onFinish: (state: MatchState) => void;
}

export function MatchScreen({ initialState, onFinish }: Props) {
  // Kick-off is walked forward here rather than in an effect: advancing is
  // pure and seeded, so doing it in the initialiser keeps React's double
  // invocation in development from quietly skipping the opening moment.
  const [state, setState] = useState<MatchState>(() =>
    initialState.phase === 'kick-off' ? advanceMatch(initialState) : initialState,
  );
  const [stage, setStage] = useState<Stage>('choosing');
  const [selected, setSelected] = useState<ActionOption | null>(null);
  const [pending, setPending] = useState<CommitResult | null>(null);

  const options = useMemo(
    () => (state.phase === 'decision' ? getDecisionOptions(state) : []),
    [state],
  );

  const event = state.currentEvent;
  const opponent = getClub(oppositionClubId(state));
  const actorName = useMemo(() => {
    if (!event) return '';
    const squad = getClubWithSquad(state.userClubId);
    return squad.players.find((p) => p.id === event.actorId)?.name ?? '';
  }, [event, state.userClubId]);

  function selectAction(actionId: string) {
    const option = options.find((o) => o.action.id === actionId);
    if (!option) return;
    setSelected(option);
    setStage('locked');
  }

  function roll() {
    if (!selected) return;
    setPending(commitAction(state, selected.action.id));
    setStage('rolling');
  }

  /** The scoreline updates at the exact moment the number lands. */
  function handleRevealed() {
    if (!pending) return;
    setState(pending.state);
    setStage('revealed');
  }

  function next() {
    const base = pending?.state ?? state;
    setPending(null);
    setSelected(null);
    setStage('choosing');
    setState(advanceMatch(base));
  }

  if (state.phase === 'extra-time') {
    return (
      <div className="match">
        <Scoreboard state={state} />
        <section className="card card--centred">
          <p className="eyebrow">Level at ninety</p>
          <h1 className="card__title">Extra time</h1>
          <p className="muted">
            Thirty more minutes. This tie has to produce a winner — and if it still
            hasn't after 120, it goes to penalties.
          </p>
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => setState(advanceMatch(state))}
            autoFocus
          >
            Play extra time
          </button>
        </section>
        <section className="card">
          <h2 className="card__title">Commentary</h2>
          <MatchTimeline log={state.log} limit={8} />
        </section>
      </div>
    );
  }

  if (state.phase === 'shootout' && state.shootout) {
    const shootout = state.shootout;
    return (
      <div className="match">
        <Scoreboard state={state} />
        <PenaltyShootout
          shootout={shootout}
          onUpdate={(next) => setState({ ...state, shootout: next })}
        />
        {shootout.complete && (
          <section className="card card--centred">
            <p className="eyebrow">Settled on penalties</p>
            <h2 className="card__title">
              {getClub(shootout.winnerClubId!).name} go through
            </h2>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => onFinish({ ...state, phase: 'full-time', shootout })}
              autoFocus
            >
              See the match report
            </button>
          </section>
        )}
      </div>
    );
  }

  if (state.phase === 'full-time') {
    return (
      <div className="match">
        <Scoreboard state={state} />
        <section className="card card--centred">
          <p className="eyebrow">Full time</p>
          <h1 className="card__title">That's that.</h1>
          <button type="button" className="btn btn--primary btn--block" onClick={() => onFinish(state)}>
            See the match report
          </button>
        </section>
        <section className="card">
          <h2 className="card__title">Match commentary</h2>
          <MatchTimeline log={state.log} />
        </section>
      </div>
    );
  }

  return (
    <div className="match">
      <Scoreboard state={state} />

      {event && (
        <section className="card card--event">
          <p className={`eyebrow ${event.side === 'defence' ? 'eyebrow--defence' : ''}`}>
            {SITUATION_KICKER[event.situation]} · {state.minute}'
          </p>
          <p className="event__narrative">{event.narrative}</p>
          <p className="muted small">
            {event.side === 'attack'
              ? `${actorName} has it. ${opponent.shortName} are set.`
              : `${opponent.shortName} are coming at you. ${actorName} has to deal with it.`}
          </p>

          {state.carriedAdvantage && (
            <p
              className={`advantage ${
                state.carriedAdvantage.value > 0 ? 'is-good' : 'is-bad'
              }`}
            >
              <span aria-hidden="true">{state.carriedAdvantage.value > 0 ? '⚡' : '⚠'}</span>
              <span>
                <strong>{state.carriedAdvantage.label}</strong> — that last roll is worth{' '}
                {signed(state.carriedAdvantage.value)} on this decision.
              </span>
            </p>
          )}
        </section>
      )}

      {stage === 'choosing' && state.phase === 'decision' && (
        <section className="card">
          <h2 className="card__title">What do you do?</h2>
          <p className="muted small">
            Every option is available, however unlikely. Tap “Why?” to see how a number was
            arrived at.
          </p>
          <ActionList options={options} onSelect={selectAction} />
        </section>
      )}

      {stage === 'locked' && selected && (
        <section className="card card--locked">
          <p className="eyebrow">Probability locked</p>
          <h2 className="locked__name">{selected.action.name}</h2>
          <p className={`locked__pct band-text-${probabilityBand(selected.probability)}`}>
            {selected.probability}%
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
            roll={pending.resolution.roll}
            probability={pending.resolution.probability}
            band={pending.resolution.band}
            revealed={stage === 'revealed'}
            onRevealed={handleRevealed}
          />
          <ProbabilityBar
            probability={pending.resolution.probability}
            roll={stage === 'revealed' ? pending.resolution.roll : undefined}
          />

          {stage === 'revealed' && (
            <>
              <p className="outcome__commentary">{pending.resolution.commentary}</p>
              <button type="button" className="btn btn--primary btn--block" onClick={next} autoFocus>
                Continue
              </button>
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="card__title">Commentary</h2>
        <MatchTimeline log={state.log} limit={12} />
      </section>
    </div>
  );
}
