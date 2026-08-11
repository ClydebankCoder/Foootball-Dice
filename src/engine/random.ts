/**
 * The single source of randomness in the application.
 *
 * Nothing outside this file should call `Math.random()`. Everything takes an
 * `Rng`, which means any match can be replayed exactly by re-using its seed —
 * and it leaves room to swap in a server-authoritative roll later without
 * touching the engine.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
}

/** Deterministic, fast, good enough for a game: mulberry32. */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Non-deterministic RNG for normal play. */
export function createRng(): Rng {
  return { next: () => Math.random() };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * The D100 at the heart of the game: an integer from 1 to 100 inclusive.
 *
 * It is a genuine 1–100 roll rather than a float compared against a
 * percentage, because the player is shown the number and has to be able to
 * trust it.
 */
export function rollD100(rng: Rng): number {
  return Math.floor(rng.next() * 100) + 1;
}

/** Integer in [min, max] inclusive. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() called with an empty list');
  return items[Math.floor(rng.next() * items.length)];
}

/** Returns true with the given percentage chance (0–100). */
export function chance(rng: Rng, percent: number): boolean {
  return rollD100(rng) <= percent;
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
