import { afterEach, beforeAll, describe, it, expect } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Point DATABASE_PATH at a throwaway file before importing the db module.
const TMP_DB = join(tmpdir(), `sonar-test-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = TMP_DB;

const { ensureUser, getUser, setRiskPreferences } = await import('../users.js');
const { logRisk, setOutcome, getRecentRiskLogs } = await import('../riskLogs.js');
const { upsertBehavioral, getBehavioral } = await import('../behavioral.js');
const { closeDb } = await import('../index.js');

const WALLET = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

beforeAll(() => ensureUser(WALLET));

afterEach(() => {
  /* keep state across tests within this file — schema is shared */
});

describe('users repo', () => {
  it('ensureUser is idempotent and persists', () => {
    const a = ensureUser(WALLET);
    const b = ensureUser(WALLET);
    expect(a.wallet_address).toBe(WALLET);
    expect(b.created_at).toBe(a.created_at);
  });

  it('setRiskPreferences round-trips JSON', () => {
    const updated = setRiskPreferences(WALLET, { minRiskToBlock: 50, voiceEnabled: false });
    expect(updated?.risk_preferences).toEqual({ minRiskToBlock: 50, voiceEnabled: false });
    expect(getUser(WALLET)?.risk_preferences).toEqual({
      minRiskToBlock: 50,
      voiceEnabled: false,
    });
  });
});

describe('risk_logs repo', () => {
  it('logRisk + getRecentRiskLogs returns the inserted row with hydrated reasons', () => {
    logRisk({
      wallet: WALLET,
      sessionId: '11111111-1111-1111-1111-111111111111',
      riskScore: 88,
      findings: [
        { rule: 'unlimited_approval', level: 'critical', points: 30, message: 'x' },
      ],
      scenario: 'unlimited_approval',
      domain: 'phantom-airdrop.xyz',
      counterparty: 'CP',
    });
    const logs = getRecentRiskLogs(WALLET);
    expect(logs.length).toBeGreaterThan(0);
    const latest = logs[0];
    expect(latest.session_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(latest.outcome).toBe('pending');
    expect(latest.reasons[0].rule).toBe('unlimited_approval');
  });

  it('setOutcome updates the matching session', () => {
    setOutcome('11111111-1111-1111-1111-111111111111', 'confirmed');
    const latest = getRecentRiskLogs(WALLET)[0];
    expect(latest.outcome).toBe('confirmed');
  });
});

describe('behavioral_data repo', () => {
  it('upsert then read returns the snapshot fields', () => {
    upsertBehavioral({
      wallet: WALLET,
      sampleSize: 50,
      windowDays: 7,
      avgTransferSol: 0.5,
      maxTransferSol: 5,
      txPerDay: 7.1,
      topCounterparties: ['CP_A', 'CP_B'],
      topPrograms: ['PROG_X'],
      activeHoursUtc: [9, 10, 11],
      chains: { SOL: 50 },
      computedAt: 1700000000000,
    });
    const snap = getBehavioral(WALLET);
    expect(snap?.avgTransferSol).toBe(0.5);
    expect(snap?.topCounterparties).toEqual(['CP_A', 'CP_B']);
    expect(snap?.activeHoursUtc).toEqual([9, 10, 11]);
  });

  it('upsert overwrites on conflict', () => {
    upsertBehavioral({
      wallet: WALLET,
      sampleSize: 200,
      windowDays: 30,
      avgTransferSol: 1.5,
      maxTransferSol: 10,
      txPerDay: 6.7,
      topCounterparties: ['CP_NEW'],
      topPrograms: ['PROG_Y'],
      activeHoursUtc: [3],
      chains: { SOL: 200 },
      computedAt: 1700000001000,
    });
    const snap = getBehavioral(WALLET);
    expect(snap?.sampleSize).toBe(200);
    expect(snap?.topCounterparties).toEqual(['CP_NEW']);
  });
});

import { afterAll } from 'vitest';
afterAll(() => {
  closeDb();
  if (existsSync(TMP_DB)) rmSync(TMP_DB);
  if (existsSync(`${TMP_DB}-wal`)) rmSync(`${TMP_DB}-wal`);
  if (existsSync(`${TMP_DB}-shm`)) rmSync(`${TMP_DB}-shm`);
});
