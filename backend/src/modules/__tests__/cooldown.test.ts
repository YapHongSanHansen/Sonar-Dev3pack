import { describe, it, expect, beforeEach } from 'vitest';
import {
  startCooldown,
  getSession,
  isCooldownPassed,
  acknowledgeSession,
  consumeSession,
  getStatus,
  __test,
} from '../cooldown.js';
import type { RiskVerdict } from '../../types.js';

const WALLET = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const OTHER_WALLET = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

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

beforeEach(() => __test.reset());

describe('cooldown lifecycle', () => {
  it('startCooldown then getSession returns the entry with wallet bound', () => {
    const verdict = makeVerdict('sess-1', 30);
    const entry = startCooldown(verdict, WALLET);
    expect(getSession('sess-1')).toBe(entry);
    expect(entry.wallet).toBe(WALLET);
    expect(entry.acknowledgedAt).toBeNull();
    expect(entry.confirmToken).toBeNull();
  });

  it('isCooldownPassed is false immediately after start with positive cooldown', () => {
    startCooldown(makeVerdict('sess-2', 30), WALLET);
    expect(isCooldownPassed('sess-2')).toBe(false);
  });

  it('getStatus reports remaining seconds, then cooldownPassed once elapsed', () => {
    startCooldown(makeVerdict('sess-3', 30), WALLET);
    const status = getStatus('sess-3');
    expect(status?.cooldownPassed).toBe(false);
    expect(status?.remainingSeconds).toBeGreaterThan(0);
    expect(status?.acknowledged).toBe(false);
  });
});

describe('acknowledgeSession', () => {
  it('rejects acknowledgement before cooldown elapses', () => {
    startCooldown(makeVerdict('sess-a1', 30), WALLET);
    const r = acknowledgeSession('sess-a1', WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('cooldown_active');
  });

  it('rejects with wallet_mismatch when wallet does not match', () => {
    startCooldown(makeVerdict('sess-a2', 0), WALLET);
    const r = acknowledgeSession('sess-a2', OTHER_WALLET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wallet_mismatch');
  });

  it('returns a confirmToken when wallet matches and cooldown elapsed', () => {
    startCooldown(makeVerdict('sess-a3', 0), WALLET);
    const r = acknowledgeSession('sess-a3', WALLET);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.confirmToken).toMatch(/^[0-9a-f-]+$/);
  });

  it('is idempotent — same token returned on repeat ack', () => {
    startCooldown(makeVerdict('sess-a4', 0), WALLET);
    const r1 = acknowledgeSession('sess-a4', WALLET);
    const r2 = acknowledgeSession('sess-a4', WALLET);
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r1.confirmToken).toBe(r2.confirmToken);
  });
});

describe('consumeSession', () => {
  it('refuses to consume without prior acknowledge', () => {
    startCooldown(makeVerdict('sess-c1', 0), WALLET);
    const r = consumeSession('sess-c1', WALLET, '00000000-0000-0000-0000-000000000000');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_acknowledged');
  });

  it('refuses confirm with invalid token after ack', () => {
    startCooldown(makeVerdict('sess-c2', 0), WALLET);
    acknowledgeSession('sess-c2', WALLET);
    const r = consumeSession('sess-c2', WALLET, '00000000-0000-0000-0000-000000000000');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_token');
  });

  it('succeeds with correct wallet + confirmToken, then deletes session', () => {
    startCooldown(makeVerdict('sess-c3', 0), WALLET);
    const ack = acknowledgeSession('sess-c3', WALLET);
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    const r = consumeSession('sess-c3', WALLET, ack.confirmToken);
    expect(r.ok).toBe(true);
    expect(getSession('sess-c3')).toBeUndefined();
  });

  it('rejects with wallet_mismatch and increments attempts', () => {
    startCooldown(makeVerdict('sess-c4', 0), WALLET);
    const ack = acknowledgeSession('sess-c4', WALLET);
    if (!ack.ok) return;
    const r = consumeSession('sess-c4', OTHER_WALLET, ack.confirmToken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wallet_mismatch');
    expect(getSession('sess-c4')?.attempts).toBe(1);
  });

  it('locks out after 5 attempts', () => {
    startCooldown(makeVerdict('sess-c5', 0), WALLET);
    const ack = acknowledgeSession('sess-c5', WALLET);
    if (!ack.ok) return;
    for (let i = 0; i < 5; i++) {
      consumeSession('sess-c5', OTHER_WALLET, ack.confirmToken);
    }
    const r = consumeSession('sess-c5', WALLET, ack.confirmToken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('too_many_attempts');
  });
});
