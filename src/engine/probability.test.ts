import { describe, expect, it } from 'vitest';
import { ACTIONS, getActionsForSituation } from './actions';
import { calculateProbability, MAX_PROBABILITY, MIN_PROBABILITY } from './probability';
import type { ActionContext } from './probability';
import { getSituation } from './situations';
import { getClubWithSquad } from '../data/world';
import { CLUBS } from '../data/clubs';
import { SITUATIONS } from './situations';
import type { Player, SituationId, Tactics } from '../types';

const TACTICS: Tactics = {
  mentality: 'balanced',
  passing: 'mixed',
  tempo: 'normal',
  pressing: 'medium',
};

function contextFor(actor: Player, situation: SituationId): ActionContext {
  return {
    actor,
    opposition: getClubWithSquad('inverclyde-fc').ratings,
    tactics: TACTICS,
    situation: getSituation(situation),
    isHome: true,
    minute: 30,
  };
}

const rovers = getClubWithSquad('greenock-rovers');
const midfielder = rovers.players.find((p) => p.position === 'MID')!;

describe('the breakdown', () => {
  it('adds up exactly to the raw total shown to the player', () => {
    for (const action of ACTIONS) {
      const situation = action.situations[0];
      const breakdown = calculateProbability(action, contextFor(midfielder, situation));
      const sum = breakdown.base + breakdown.factors.reduce((t, f) => t + f.value, 0);
      expect(sum).toBe(breakdown.raw);
    }
  });

  it('never lists a factor worth nothing', () => {
    for (const action of ACTIONS) {
      const breakdown = calculateProbability(action, contextFor(midfielder, action.situations[0]));
      expect(breakdown.factors.every((f) => f.value !== 0)).toBe(true);
    }
  });

  it('explains itself with at least the situational modifiers', () => {
    const action = ACTIONS.find((a) => a.id === 'through-ball')!;
    const breakdown = calculateProbability(action, contextFor(midfielder, 'build-up'));
    const labels = breakdown.factors.map((f) => f.label);
    expect(labels).toContain('Home advantage');
    expect(labels).toContain('Pressure on the ball');
  });
});

describe('clamping', () => {
  it('keeps every action in every situation between 1% and 99%', () => {
    for (const club of CLUBS) {
      const squad = getClubWithSquad(club.id);
      for (const player of squad.players) {
        for (const situationId of Object.keys(SITUATIONS) as SituationId[]) {
          for (const action of getActionsForSituation(situationId)) {
            const probability = calculateProbability(
              action,
              contextFor(player, situationId),
            ).final;
            expect(probability).toBeGreaterThanOrEqual(MIN_PROBABILITY);
            expect(probability).toBeLessThanOrEqual(MAX_PROBABILITY);
          }
        }
      }
    }
  });
});

describe('attributes matter', () => {
  it('gives a better passer a better through ball', () => {
    const action = ACTIONS.find((a) => a.id === 'through-ball')!;
    const weak: Player = {
      ...midfielder,
      attributes: { ...midfielder.attributes, passing: 30, vision: 30, technique: 30 },
    };
    const strong: Player = {
      ...midfielder,
      attributes: { ...midfielder.attributes, passing: 90, vision: 90, technique: 90 },
    };
    const weakProbability = calculateProbability(action, contextFor(weak, 'build-up')).final;
    const strongProbability = calculateProbability(action, contextFor(strong, 'build-up')).final;
    expect(strongProbability).toBeGreaterThan(weakProbability);
  });

  it('penalises a tired player', () => {
    const action = ACTIONS.find((a) => a.id === 'dribble')!;
    const fresh = calculateProbability(action, contextFor({ ...midfielder, fitness: 100 }, 'wing-attack'));
    const spent = calculateProbability(action, contextFor({ ...midfielder, fitness: 55 }, 'wing-attack'));
    expect(spent.final).toBeLessThan(fresh.final);
    expect(spent.factors.some((f) => f.label === 'Fatigue')).toBe(true);
  });

  it('rewards playing at home', () => {
    const action = ACTIONS.find((a) => a.id === 'cross')!;
    const home = calculateProbability(action, contextFor(midfielder, 'wing-attack'));
    const away = calculateProbability(action, {
      ...contextFor(midfielder, 'wing-attack'),
      isHome: false,
    });
    expect(home.final).toBeGreaterThan(away.final);
  });
});

describe('the action catalogue', () => {
  it('offers a decision in every situation', () => {
    for (const situationId of Object.keys(SITUATIONS) as SituationId[]) {
      expect(getActionsForSituation(situationId).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('has unique ids', () => {
    const ids = ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers something extreme in the attacking situations', () => {
    for (const situationId of ['build-up', 'final-third', 'wing-attack', 'one-on-one', 'box-chance'] as SituationId[]) {
      const extremes = getActionsForSituation(situationId).filter(
        (a) => a.riskLevel === 'extreme',
      );
      expect(extremes.length).toBeGreaterThan(0);
    }
  });
});
