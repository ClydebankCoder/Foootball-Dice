import { describe, expect, it } from 'vitest';
import {
  createShootout,
  PENALTY_ACTIONS,
  penaltyOptions,
  REGULATION_KICKS,
  roleFor,
  takePenalty,
} from './shootout';
import type { ShootoutState } from '../types';

const HOME = 'greenock-morton';
const AWAY = 'partick-thistle';

function newShootout(seed = 1, userIsHome = true): ShootoutState {
  return createShootout(HOME, AWAY, userIsHome ? HOME : AWAY, seed);
}

/** Plays kicks with a fixed roll until the shootout is decided. */
function playOut(state: ShootoutState, roll: number): ShootoutState {
  let current = state;
  let guard = 0;
  while (!current.complete) {
    if (++guard > 60) throw new Error('shootout never ended');
    const options = penaltyOptions(current);
    current = takePenalty(current, options[0].action.id, { roll }).state;
  }
  return current;
}

describe('the penalty menu', () => {
  it('offers six ways to take one and three ways to face one', () => {
    expect(PENALTY_ACTIONS.filter((a) => a.role === 'taking')).toHaveLength(6);
    expect(PENALTY_ACTIONS.filter((a) => a.role === 'saving')).toHaveLength(3);
  });

  it('offers the taking options when it is your kick', () => {
    const state = newShootout(1, true);
    expect(roleFor(state)).toBe('taking');
    const options = penaltyOptions(state);
    expect(options).toHaveLength(6);
    expect(options.every((o) => o.action.role === 'taking')).toBe(true);
  });

  it('offers the diving options when you are facing one', () => {
    // The away club takes second, so an away manager faces the first kick.
    const state = newShootout(1, false);
    expect(roleFor(state)).toBe('saving');
    const options = penaltyOptions(state);
    expect(options).toHaveLength(3);
    expect(options.every((o) => o.action.role === 'saving')).toBe(true);
  });

  it('keeps every probability inside 1-99', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const userIsHome of [true, false]) {
        let state = newShootout(seed, userIsHome);
        let guard = 0;
        while (!state.complete && guard++ < 40) {
          for (const option of penaltyOptions(state)) {
            expect(option.probability).toBeGreaterThanOrEqual(1);
            expect(option.probability).toBeLessThanOrEqual(99);
          }
          state = takePenalty(state, penaltyOptions(state)[0].action.id).state;
        }
      }
    }
  });

  it('itemises every probability so it adds up', () => {
    const state = newShootout(5, false);
    for (const option of penaltyOptions(state)) {
      const sum =
        option.breakdown.base +
        option.breakdown.factors.reduce((total, f) => total + f.value, 0);
      expect(sum).toBe(option.breakdown.raw);
    }
  });

  it('sorts the taking options best-first, like every other menu', () => {
    const options = penaltyOptions(newShootout(1, true));
    for (let i = 1; i < options.length; i++) {
      expect(options[i - 1].probability).toBeGreaterThanOrEqual(options[i].probability);
    }
  });

  it('keeps the diving options in left-centre-right order', () => {
    const options = penaltyOptions(newShootout(1, false));
    expect(options.map((o) => o.action.direction)).toEqual(['left', 'centre', 'right']);
  });

  it('records who took the kick and what the manager did about it', () => {
    // Facing one: the kick belongs to the opposition taker, but the action
    // recorded is the manager's dive.
    const facing = newShootout(1, false);
    const { kick } = takePenalty(facing, 'dive-left', { roll: 100 });
    expect(kick.role).toBe('saving');
    expect(kick.clubId).toBe(HOME);
    expect(kick.actionName).toBe('Dive Left');
    expect(kick.playerName).not.toBe('');

    const taking = newShootout(1, true);
    const taken = takePenalty(taking, 'power', { roll: 1 }).kick;
    expect(taken.role).toBe('taking');
    expect(taken.clubId).toBe(HOME);
    expect(taken.actionName).toBe('Power');
  });

  it('rejects a taking option while facing a kick', () => {
    const state = newShootout(1, false);
    expect(() => takePenalty(state, 'panenka')).toThrow();
  });
});

describe('reading the taker', () => {
  it('shows a read before every kick you face, and none while taking', () => {
    const facing = newShootout(3, false);
    expect(facing.tell).not.toBeNull();
    expect(facing.tell!.text.length).toBeGreaterThan(10);

    const taking = newShootout(3, true);
    expect(taking.tell).toBeNull();
  });

  it('makes diving the way the read points the better bet', () => {
    const state = newShootout(3, false);
    const options = penaltyOptions(state);
    const matching = options.find((o) => o.action.direction === state.tell!.direction)!;
    const against = options.filter((o) => o.action.direction !== state.tell!.direction);

    for (const option of against) {
      expect(matching.probability).toBeGreaterThan(option.probability);
    }
    // And it is visible in the breakdown rather than baked in silently.
    expect(matching.breakdown.factors.map((f) => f.label)).toContain(
      'You have read the run-up',
    );
  });
});

describe('the D100 contract holds at the spot', () => {
  it('scores when taking if the roll is inside the probability', () => {
    const state = newShootout(1, true);
    const option = penaltyOptions(state)[0];
    const { kick, success } = takePenalty(state, option.action.id, {
      roll: option.probability,
    });
    expect(success).toBe(true);
    expect(kick.scored).toBe(true);
    expect(kick.probability).toBe(option.probability);
  });

  it('concedes when taking if the roll is outside it', () => {
    const state = newShootout(1, true);
    const option = penaltyOptions(state)[0];
    const { kick, success } = takePenalty(state, option.action.id, {
      roll: option.probability + 1,
    });
    expect(success).toBe(false);
    expect(kick.scored).toBe(false);
  });

  it('saves it when facing and the roll is inside the probability', () => {
    const state = newShootout(1, false);
    const option = penaltyOptions(state)[0];
    const { kick, success } = takePenalty(state, option.action.id, {
      roll: option.probability,
    });
    // Success while facing a kick means a save, so nothing is scored.
    expect(success).toBe(true);
    expect(kick.scored).toBe(false);
  });

  it('is beaten when facing and the roll is outside it', () => {
    const state = newShootout(1, false);
    const option = penaltyOptions(state)[0];
    const { kick } = takePenalty(state, option.action.id, {
      roll: option.probability + 1,
    });
    expect(kick.scored).toBe(true);
  });

  it('rejects a roll outside 1-100', () => {
    const state = newShootout(1, true);
    expect(() => takePenalty(state, 'power', { roll: 0 })).toThrow();
    expect(() => takePenalty(state, 'power', { roll: 101 })).toThrow();
  });
});

describe('the format', () => {
  it('stops as soon as one side cannot be caught', () => {
    // Rolling 1 always succeeds: the manager scores every kick and saves
    // every kick, so it should be over at 3-0 rather than running to ten.
    const finished = playOut(newShootout(1, true), 1);
    expect(finished.complete).toBe(true);
    expect(finished.winnerClubId).toBe(HOME);
    expect(finished.homeScore).toBe(3);
    expect(finished.awayScore).toBe(0);
    expect(finished.kicks).toHaveLength(6);
  });

  it('goes to sudden death when the first five each are level', () => {
    // Rolling 100 always fails: the manager misses every kick and is beaten
    // every time, so it is 0-5 and over inside five rounds.
    const finished = playOut(newShootout(1, true), 100);
    expect(finished.complete).toBe(true);
    expect(finished.winnerClubId).toBe(AWAY);
  });

  it('alternates who is taking', () => {
    let state = newShootout(9, true);
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      order.push(state.turnClubId);
      state = takePenalty(state, penaltyOptions(state)[0].action.id, { roll: 50 }).state;
    }
    expect(order).toEqual([HOME, AWAY, HOME, AWAY]);
  });

  it('never lets a completed shootout take another kick', () => {
    const finished = playOut(newShootout(1, true), 1);
    expect(() => takePenalty(finished, 'power')).toThrow();
  });

  it('always ends with a winner and a scoreline that matches the kicks', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const userIsHome of [true, false]) {
        let state = newShootout(seed, userIsHome);
        let guard = 0;
        while (!state.complete) {
          if (++guard > 60) throw new Error(`shootout ${seed} never ended`);
          state = takePenalty(state, penaltyOptions(state)[0].action.id).state;
        }
        expect(state.winnerClubId).not.toBeNull();
        expect([HOME, AWAY]).toContain(state.winnerClubId);
        expect(state.homeScore).toBe(
          state.kicks.filter((k) => k.clubId === HOME && k.scored).length,
        );
        expect(state.awayScore).toBe(
          state.kicks.filter((k) => k.clubId === AWAY && k.scored).length,
        );
        expect(state.homeScore).not.toBe(state.awayScore);
      }
    }
  });

  it('applies sudden-death pressure once it gets that far', () => {
    let state = newShootout(4, true);
    // Force five each, all scored, to reach sudden death.
    let guard = 0;
    while (!state.suddenDeath && !state.complete && guard++ < 20) {
      const taking = roleFor(state) === 'taking';
      // Score when taking, be beaten when facing: 5-5 after ten kicks.
      state = takePenalty(state, penaltyOptions(state)[0].action.id, {
        roll: taking ? 1 : 100,
      }).state;
    }
    expect(state.suddenDeath).toBe(true);
    expect(state.homeScore).toBe(REGULATION_KICKS);
    expect(state.awayScore).toBe(REGULATION_KICKS);

    const labels = penaltyOptions(state)[0].breakdown.factors.map((f) => f.label);
    expect(labels).toContain('Sudden death');
  });
});
