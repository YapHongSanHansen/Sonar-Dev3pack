import { supabase } from './client.js';
import type { BaselineSnapshot } from '../types.js';

type Row = {
  wallet_address: string;
  sample_size: number;
  window_days: number;
  avg_transfer_sol: number;
  max_transfer_sol: number;
  tx_per_day: number;
  top_counterparties: string[];
  top_programs: string[];
  active_hours_utc: number[];
  chains: Record<string, number>;
  computed_at: number;
};

function hydrate(row: Row): BaselineSnapshot {
  return {
    wallet: row.wallet_address,
    sampleSize: row.sample_size,
    windowDays: row.window_days,
    avgTransferSol: row.avg_transfer_sol,
    maxTransferSol: row.max_transfer_sol,
    txPerDay: row.tx_per_day,
    topCounterparties: row.top_counterparties,
    topPrograms: row.top_programs,
    activeHoursUtc: row.active_hours_utc,
    chains: row.chains,
    computedAt: row.computed_at,
  };
}

export async function getBehavioral(wallet: string): Promise<BaselineSnapshot | null> {
  const { data, error } = await supabase()
    .from('behavioral_data')
    .select('*')
    .eq('wallet_address', wallet)
    .maybeSingle();
  if (error) throw new Error(`getBehavioral(${wallet}): ${error.message}`);
  return data ? hydrate(data as Row) : null;
}

export async function upsertBehavioral(snap: BaselineSnapshot): Promise<void> {
  const { error } = await supabase()
    .from('behavioral_data')
    .upsert(
      {
        wallet_address: snap.wallet,
        sample_size: snap.sampleSize,
        window_days: snap.windowDays,
        avg_transfer_sol: snap.avgTransferSol,
        max_transfer_sol: snap.maxTransferSol,
        tx_per_day: snap.txPerDay,
        top_counterparties: snap.topCounterparties,
        top_programs: snap.topPrograms,
        active_hours_utc: snap.activeHoursUtc,
        chains: snap.chains,
        computed_at: snap.computedAt,
      },
      { onConflict: 'wallet_address' },
    );
  if (error) throw new Error(`upsertBehavioral(${snap.wallet}): ${error.message}`);
}
