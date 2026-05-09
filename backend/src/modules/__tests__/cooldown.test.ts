import { describe, it, expect } from 'vitest';
import {
  startCooldown,
  getSession,
  isCooldownPassed,
  consumeSession,
} from '../cooldown.js';
import type { RiskVerdict } from '../../types.js';

function makeVerdict(sessionId: string, cooldownSeconds: number): RiskVerdict {
  return {
    riskRequired: true,
    score: 60,
    cooldownSeconds,
    sim: {
      simulatedTransfer: '50 SOL',
      approval: 'none',
      programVerified: false,
      programIds: ['WALLET_1'],
      rawNote: 'test',
    },
    ctx: {
      domain: null,
      counterparty: null,
      walletAgeDays: null,
      hasPriorInteraction: null,
      scamReportCount: null,
      domainAgeDays: null,
      domainSuspicionReasons: [],
      baseline: null,
    },
    findings: [],
    voiceScript: 'test script',
    sessionId,
  };
}

describe('cooldown', () => {
  it('startCooldown then getSession returns the entry', () => {
    const verdict = makeVerdict('sess-1', 15);
    const entry = startCooldown(verdict);
    const fetched = getSession('sess-1');
    expect(fetched).toBe(entry);
    expect(fetched?.sessionId).toBe('sess-1');
  });

  it('isCooldownPassed returns false immediately after start with positive cooldownSeconds', () => {
    const verdict = makeVerdict('sess-2', 30);
    startCooldown(verdict);
    expect(isCooldownPassed('sess-2')).toBe(false);
  });

  it('consumeSession returns the entry and removes it', () => {
    const verdict = makeVerdict('sess-3', 10);
    startCooldown(verdict);
    const consumed = consumeSession('sess-3');
    expect(consumed?.sessionId).toBe('sess-3');
    expect(getSession('sess-3')).toBeUndefined();
  });
});
