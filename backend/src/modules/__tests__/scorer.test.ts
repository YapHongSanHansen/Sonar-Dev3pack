import { describe, it, expect } from 'vitest';
import { score, cooldownFor } from '../scorer.js';
import { pickScenario } from '../scenarios.js';
import type { InterceptorPayload } from '../../types.js';

const basePayload: InterceptorPayload = {
  wallet: '11111111111111111111111111111111',
  transaction: 'abc',
  type: 'signTransaction',
};

describe('score', () => {
  it('returns score 0 with no findings for the safe scenario', () => {
    const { sim, ctx } = pickScenario('safe');
    const result = score(sim, ctx, { ...basePayload, scenario: 'safe' });
    expect(result.score).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('flags drainer with critical findings and >= 80 score', () => {
    const { sim, ctx } = pickScenario('drainer');
    const result = score(sim, ctx, { ...basePayload, scenario: 'drainer' });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.findings.some((f) => f.rule === 'unverified_program')).toBe(true);
    expect(result.findings.some((f) => f.rule === 'scam_reports')).toBe(true);
    expect(result.findings.some((f) => f.rule === 'wallet_age')).toBe(true);
    expect(result.findings.some((f) => f.rule === 'domain_age')).toBe(true);
  });

  it('flags unlimited_approval with the unlimited rule', () => {
    const { sim, ctx } = pickScenario('unlimited_approval');
    const result = score(sim, ctx, { ...basePayload, scenario: 'unlimited_approval' });
    expect(result.findings.some((f) => f.rule === 'unlimited_approval')).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('flags fake_token name impersonation', () => {
    const { sim, ctx } = pickScenario('fake_token');
    const result = score(sim, ctx, { ...basePayload, scenario: 'fake_token' });
    expect(result.findings.some((f) => f.rule === 'fake_token_name')).toBe(true);
  });

  it('flags phishing message text on signMessage requests', () => {
    const { sim, ctx } = pickScenario('phishing_message');
    const result = score(sim, ctx, {
      ...basePayload,
      type: 'signMessage',
      messageText: 'Please reveal your seed phrase to verify wallet ownership.',
      scenario: 'phishing_message',
    });
    expect(result.findings.some((f) => f.rule === 'phishing_message')).toBe(true);
  });

  it('caps the score at 100', () => {
    const { sim, ctx } = pickScenario('drainer');
    const ctxWithEverything = { ...ctx, scamReportCount: 999 };
    const result = score(sim, ctxWithEverything, basePayload);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('attaches rule id and points to every finding', () => {
    const { sim, ctx } = pickScenario('drainer');
    const result = score(sim, ctx, basePayload);
    for (const f of result.findings) {
      expect(typeof f.rule).toBe('string');
      expect(typeof f.points).toBe('number');
      expect(f.points).toBeGreaterThan(0);
    }
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
