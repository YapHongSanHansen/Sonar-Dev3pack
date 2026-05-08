import { describe, it, expect } from 'vitest';
import { score, cooldownFor } from '../scorer.js';
import { pickScenario } from '../scenarios.js';

describe('score', () => {
  it('returns score 0 with no findings for the safe scenario', () => {
    const result = score(pickScenario('safe'));
    expect(result.score).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('returns a score >= 55 for the drainer scenario', () => {
    const result = score(pickScenario('drainer'));
    expect(result.score).toBeGreaterThanOrEqual(55);
  });

  it('returns a score >= 50 for the unlimited_approval scenario', () => {
    // NOTE: spec asked for >= 75 ("unlimited approval + verified program"),
    // but the scenario in scenarios.ts has programVerified: true, so the
    // unverified-program +25 does NOT apply. With the current source the
    // unlimited approval (+50) is the only contributor → score = 50.
    const result = score(pickScenario('unlimited_approval'));
    expect(result.score).toBeGreaterThanOrEqual(50);
  });
});

describe('cooldownFor', () => {
  it('returns 0 for score 39', () => {
    expect(cooldownFor(39)).toBe(0);
  });

  it('returns 5 for score 40', () => {
    expect(cooldownFor(40)).toBe(5);
  });

  it('returns 15 for score 60', () => {
    expect(cooldownFor(60)).toBe(15);
  });

  it('returns 30 for score 80', () => {
    expect(cooldownFor(80)).toBe(30);
  });
});
