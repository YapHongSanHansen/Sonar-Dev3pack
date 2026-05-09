import { describe, it, expect } from 'vitest';
import { computeBaseline } from '../baseline.js';
import type { ParsedTx } from '../sources/helius.js';

const wallet = 'WALLET_USER';
const cp1 = 'COUNTER_1';
const cp2 = 'COUNTER_2';
const prog = 'PROGRAM_X';

function tx(amountSol: number, hourUtc: number, dayOffset: number): ParsedTx {
  const ts = Math.floor(Date.UTC(2026, 0, dayOffset, hourUtc) / 1000);
  return {
    timestamp: ts,
    nativeTransfers: [
      { fromUserAccount: wallet, toUserAccount: cp1, amount: amountSol * 1e9 },
    ],
    instructions: [{ programId: prog }],
  };
}

describe('computeBaseline', () => {
  it('computes avg + max transfer in SOL', () => {
    const txs = [tx(1, 12, 1), tx(2, 13, 2), tx(3, 14, 3)];
    const snap = computeBaseline(wallet, txs);
    expect(snap.avgTransferSol).toBe(2);
    expect(snap.maxTransferSol).toBe(3);
    expect(snap.sampleSize).toBe(3);
  });

  it('ranks counterparties and programs by frequency', () => {
    const txs: ParsedTx[] = [
      { timestamp: 1, nativeTransfers: [{ toUserAccount: cp1, fromUserAccount: wallet, amount: 1e9 }], instructions: [{ programId: prog }] },
      { timestamp: 2, nativeTransfers: [{ toUserAccount: cp1, fromUserAccount: wallet, amount: 1e9 }], instructions: [{ programId: prog }] },
      { timestamp: 3, nativeTransfers: [{ toUserAccount: cp2, fromUserAccount: wallet, amount: 1e9 }], instructions: [{ programId: prog }] },
    ];
    const snap = computeBaseline(wallet, txs);
    expect(snap.topCounterparties[0]).toBe(cp1);
    expect(snap.topCounterparties).toContain(cp2);
    expect(snap.topPrograms[0]).toBe(prog);
  });

  it('derives active hours from timestamps', () => {
    const txs = [tx(1, 12, 1), tx(1, 12, 2), tx(1, 13, 3), tx(1, 3, 4)];
    const snap = computeBaseline(wallet, txs);
    expect(snap.activeHoursUtc).toContain(12);
    expect(snap.activeHoursUtc).toContain(13);
  });

  it('excludes self from counterparties', () => {
    const txs: ParsedTx[] = [
      { timestamp: 1, nativeTransfers: [{ toUserAccount: wallet, fromUserAccount: cp1, amount: 1e9 }] },
    ];
    const snap = computeBaseline(wallet, txs);
    expect(snap.topCounterparties).not.toContain(wallet);
  });
});
