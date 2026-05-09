import { describe, it, expect } from 'vitest';
import { buildVoiceScript } from '../voice.js';
import type { RiskFinding } from '../../types.js';

const corporateRedFlags = [
  'Stop. Do not sign this.',
  'compliance',
  'unauthorized access',
  'we have detected',
  'Please be advised',
  'click here',
];

function expectFriendly(script: string) {
  const lower = script.toLowerCase();
  for (const phrase of corporateRedFlags) {
    expect(lower).not.toContain(phrase.toLowerCase());
  }
  expect(script.length).toBeGreaterThan(40);
}

describe('buildVoiceScript', () => {
  it('returns a benign one-liner when there are no findings', () => {
    const script = buildVoiceScript([], 0, 'sess-x');
    expect(script).toMatch(/clean|sign whenever/i);
  });

  it('uses a casual high-risk opener for score >= 80', () => {
    const findings: RiskFinding[] = [
      {
        rule: 'unlimited_approval',
        level: 'critical',
        points: 30,
        message: 'Unlimited approval',
      },
    ];
    const script = buildVoiceScript(findings, 90, 'sess-1');
    expect(script).toMatch(/yo|hold up|hard stop|real talk|pause|hey, no/i);
    expectFriendly(script);
  });

  it('weaves walletAge evidence as "literally hours ago" when days = 0', () => {
    const findings: RiskFinding[] = [
      {
        rule: 'wallet_age',
        level: 'warning',
        points: 20,
        message: 'Counterparty wallet is only 0 day(s) old',
        evidence: { walletAgeDays: 0 },
      },
    ];
    const script = buildVoiceScript(findings, 50, 'sess-2');
    expect(script).toMatch(/literally hours ago|brand new/i);
  });

  it('quotes the exact scam-report count from evidence', () => {
    const findings: RiskFinding[] = [
      {
        rule: 'scam_reports',
        level: 'critical',
        points: 40,
        message: '14 scam reports',
        evidence: { count: 14 },
      },
    ];
    const script = buildVoiceScript(findings, 90, 'sess-3');
    expect(script).toContain('14');
    expect(script.toLowerCase()).toContain('chainabuse');
  });

  it('produces different phrasings for different sessionIds (seeded variation)', () => {
    const findings: RiskFinding[] = [
      { rule: 'unlimited_approval', level: 'critical', points: 30, message: '' },
      { rule: 'wallet_age', level: 'warning', points: 20, message: '', evidence: { walletAgeDays: 2 } },
    ];
    const variants = new Set<string>();
    for (let i = 0; i < 10; i++) variants.add(buildVoiceScript(findings, 90, `sess-${i}`));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('caps at the top 3 findings by points', () => {
    const findings: RiskFinding[] = [
      { rule: 'unlimited_approval', level: 'critical', points: 30, message: '' },
      { rule: 'wallet_age', level: 'warning', points: 20, message: '', evidence: { walletAgeDays: 1 } },
      { rule: 'no_prior_interaction', level: 'info', points: 5, message: '' },
      { rule: 'off_hours_signing', level: 'info', points: 5, message: '', evidence: { hourUtc: 3 } },
      { rule: 'unfamiliar_counterparty', level: 'info', points: 10, message: '' },
    ];
    const script = buildVoiceScript(findings, 90, 'sess-4');
    // Off-hours should NOT appear (not in top 3 by points).
    expect(script).not.toMatch(/03:00 UTC/);
  });
});
