import { db } from './index.js';
import type { BaselineSnapshot } from '../types.js';

type RawRow = {
  wallet_address: string;
  sample_size: number;
  window_days: number;
  avg_transfer_sol: number;
  max_transfer_sol: number;
  tx_per_day: number;
  top_counterparties: string;
  top_programs: string;
  active_hours_utc: string;
  chains: string;
  computed_at: number;
};

function hydrate(row: RawRow): BaselineSnapshot {
  return {
    wallet: row.wallet_address,
    sampleSize: row.sample_size,
    windowDays: row.window_days,
    avgTransferSol: row.avg_transfer_sol,
    maxTransferSol: row.max_transfer_sol,
    txPerDay: row.tx_per_day,
    topCounterparties: JSON.parse(row.top_counterparties),
    topPrograms: JSON.parse(row.top_programs),
    activeHoursUtc: JSON.parse(row.active_hours_utc),
    chains: JSON.parse(row.chains),
    computedAt: row.computed_at,
  };
}

export function getBehavioral(wallet: string): BaselineSnapshot | null {
  const row = db()
    .prepare('SELECT * FROM behavioral_data WHERE wallet_address = ?')
    .get(wallet) as RawRow | undefined;
  return row ? hydrate(row) : null;
}

export function upsertBehavioral(snap: BaselineSnapshot): void {
  db()
    .prepare(
      `INSERT INTO behavioral_data
        (wallet_address, sample_size, window_days, avg_transfer_sol, max_transfer_sol,
         tx_per_day, top_counterparties, top_programs, active_hours_utc, chains, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(wallet_address) DO UPDATE SET
         sample_size = excluded.sample_size,
         window_days = excluded.window_days,
         avg_transfer_sol = excluded.avg_transfer_sol,
         max_transfer_sol = excluded.max_transfer_sol,
         tx_per_day = excluded.tx_per_day,
         top_counterparties = excluded.top_counterparties,
         top_programs = excluded.top_programs,
         active_hours_utc = excluded.active_hours_utc,
         chains = excluded.chains,
         computed_at = excluded.computed_at`,
    )
    .run(
      snap.wallet,
      snap.sampleSize,
      snap.windowDays,
      snap.avgTransferSol,
      snap.maxTransferSol,
      snap.txPerDay,
      JSON.stringify(snap.topCounterparties),
      JSON.stringify(snap.topPrograms),
      JSON.stringify(snap.activeHoursUtc),
      JSON.stringify(snap.chains),
      snap.computedAt,
    );
}
