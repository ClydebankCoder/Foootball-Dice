import { describe, expect, it } from 'vitest';
import { ACTIONS, getAction } from './actions';
import { ACTION_LINES, describeOutcome, linesFor } from './commentary';
import { createSeededRng } from './random';
import type { OutcomeBand } from '../types';

const BANDS: OutcomeBand[] = [
  'critical-success',
  'success',
  'partial-success',
  'failure',
  'critical-failure',
];

const NAMES = { actor: 'McKenzie', opponent: 'Docherty', keeper: 'Rennie' };

describe('outcome commentary', () => {
  it('produces a filled-in line for every action in every band', () => {
    const rng = createSeededRng(1);
    for (const action of ACTIONS) {
      for (const band of BANDS) {
        const line = describeOutcome(action, band, 50, NAMES, rng);
        expect(line.length).toBeGreaterThan(0);
        // A surviving brace means a typo like {kepeer} that would ship to the
        // player as literal template text.
        expect(line).not.toMatch(/[{}]/);
      }
    }
  });

  it('only overrides actions that actually exist', () => {
    for (const id of Object.keys(ACTION_LINES)) {
      expect(() => getAction(id)).not.toThrow();
    }
  });

  it('never registers an empty override pool', () => {
    for (const [id, entry] of Object.entries(ACTION_LINES)) {
      for (const [band, lines] of Object.entries(entry.lines)) {
        expect(lines.length, `${id}/${band}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives an action that suppresses its category pool a full set of bands', () => {
    for (const [id, entry] of Object.entries(ACTION_LINES)) {
      if (!entry.exclusive) continue;
      for (const band of BANDS) {
        expect(entry.lines[band]?.length ?? 0, `${id}/${band}`).toBeGreaterThan(0);
      }
    }
  });

  it('adds bespoke lines to the pool rather than shrinking it', () => {
    // A single flavour line must never leave an action less varied than the
    // generic pool it drew from before.
    for (const [id, entry] of Object.entries(ACTION_LINES)) {
      if (entry.exclusive) continue;
      const action = getAction(id);
      for (const band of BANDS) {
        const generic = linesFor('__no_overrides__', action.category, band).length;
        const actual = linesFor(id, action.category, band).length;
        expect(actual, `${id}/${band}`).toBeGreaterThanOrEqual(generic);
      }
    }
  });

  it('uses the specific line for an action that has one', () => {
    const rng = createSeededRng(7);
    const action = getAction('round-keeper');
    const lines = new Set<string>();
    for (let i = 0; i < 200; i++) {
      lines.add(describeOutcome(action, 'failure', 50, NAMES, rng));
    }
    // Every line must come from the round-keeper pool, not the generic dribble
    // one — a failed attempt to round the keeper should not read like a
    // midfield turnover.
    for (const line of lines) {
      expect(line).toMatch(/Rennie|round/i);
    }
  });

  it('has enough variety in every shooting action to survive a season', () => {
    const rng = createSeededRng(3);
    const shooters = ACTIONS.filter((a) => a.intent.kind === 'shot');
    expect(shooters.length).toBeGreaterThan(5);

    for (const action of shooters) {
      for (const band of ['partial-success', 'failure'] as OutcomeBand[]) {
        const seen = new Set<string>();
        for (let i = 0; i < 600; i++) {
          seen.add(describeOutcome(action, band, 50, NAMES, rng));
        }
        // Fewer than this and a single match starts repeating itself.
        expect(seen.size, `${action.id}/${band}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('marks out a success that had no business coming off', () => {
    const rng = createSeededRng(9);
    const action = getAction('panenka');
    const line = describeOutcome(action, 'success', 4, NAMES, rng);
    // Long-odds successes get a flourish in front of the description.
    expect(line.length).toBeGreaterThan(40);
  });
});
