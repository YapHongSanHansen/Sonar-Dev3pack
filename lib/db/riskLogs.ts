import { supabase } from './client.js';
import type { RiskFinding } from '../types.js';

export type RiskOutcome = 'pending' | 'confirmed' | 'cancelled';

export type RiskLogRow = {
  id: number;
  wallet: string;
  session_id: string;
  risk_score: number;
  reasons: RiskFinding[];
  scenario: string | null;
  domain: string | null;
  counterparty: string | null;
  timestamp: number;
  outcome: RiskOutcome;
};

export type LogRiskInput = {
  wallet: string;
  sessionId: string;
  riskScore: number;
  findings: RiskFinding[];
  scenario?: string | null;
  domain?: string | null;
  counterparty?: string | null;
};

export async function logRisk(input: LogRiskInput): Promise<void> {
  const { error } = await supabase().from('risk_logs').insert({
    wallet: input.wallet,
    session_id: input.sessionId,
    risk_score: input.riskScore,
    reasons: input.findings,
    scenario: input.scenario ?? null,
    domain: input.domain ?? null,
    counterparty: input.counterparty ?? null,
    timestamp: Date.now(),
    outcome: 'pending',
  });
  if (error) throw new Error(`logRisk(${input.sessionId}): ${error.message}`);
}

export async function setOutcome(sessionId: string, outcome: RiskOutcome): Promise<boolean> {
  const { error, count } = await supabase()
    .from('risk_logs')
    .update({ outcome }, { count: 'exact' })
    .eq('session_id', sessionId);
  if (error) throw new Error(`setOutcome(${sessionId}): ${error.message}`);
  return (count ?? 0) > 0;
}

export async function getRecentRiskLogs(wallet: string, limit = 50): Promise<RiskLogRow[]> {
  const { data, error } = await supabase()
    .from('risk_logs')
    .select('*')
    .eq('wallet', wallet)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getRecentRiskLogs(${wallet}): ${error.message}`);
  return (data ?? []) as RiskLogRow[];
}
