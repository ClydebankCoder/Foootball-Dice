import { describe, expect, it } from 'vitest';
import { createSeededRng, pick, randomInt, rollD100, shuffle } from './random';

describe('rollD100', () => {
  it('only ever produces integers from 1 to 100', () => {
    const rng = createSeededRng(1234);
    for (let i = 0; i < 50_000; i++) {
      const roll = rollD100(rng);
      expect(Number.isInteger(roll)).toBe(true);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(100);
    }
  });

  it('reaches both ends of the range', () => {
    const rng = createSeededRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 100_000; i++) seen.add(rollD100(rng));
    expect(seen.size).toBe(100);
    expect(seen.has(1)).toBe(true);
    expect(seen.has(100)).toBe(true);
  });

  it('is roughly uniform, so a shown percentage means what it says', () => {
    const rng = createSeededRng(7);
    const samples = 200_000;
    let atOrBelow50 = 0;
    for (let i = 0; i < samples; i++) {
      if (rollD100(rng) <= 50) atOrBelow50 += 1;
    }
    expect(atOrBelow50 / samples).toBeGreaterThan(0.49);
    expect(atOrBelow50 / samples).toBeLessThan(0.51);
  });
});

describe('seeding', () => {
  it('replays the same sequence for the same seed', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    for (let i = 0; i < 200; i++) expect(rollD100(a)).toBe(rollD100(b));
  });

  it('diverges for different seeds', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    const first = Array.from({ length: 20 }, () => rollD100(a));
    const second = Array.from({ length: 20 }, () => rollD100(b));
    expect(first).not.toEqual(second);
  });
});

describe('helpers', () => {
  it('keeps randomInt within bounds inclusive', () => {
    const rng = createSeededRng(11);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const value = randomInt(rng, 3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
      seen.add(value);
    }
    expect(seen.size).toBe(5);
  });

  it('picks only from the list given', () => {
    const rng = createSeededRng(5);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 500; i++) expect(items).toContain(pick(rng, items));
  });

  it('shuffles without losing or duplicating anything', () => {
    const rng = createSeededRng(3);
    const items = Array.from({ length: 30 }, (_, i) => i);
    const shuffled = shuffle(rng, items);
    expect(shuffled).toHaveLength(items.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });
});
