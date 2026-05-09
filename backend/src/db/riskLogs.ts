import { db } from './index.js';
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

type RawRiskLogRow = Omit<RiskLogRow, 'reasons'> & { reasons: string };

function hydrate(row: RawRiskLogRow): RiskLogRow {
  return { ...row, reasons: JSON.parse(row.reasons) as RiskFinding[] };
}

export type LogRiskInput = {
  wallet: string;
  sessionId: string;
  riskScore: number;
  findings: RiskFinding[];
  scenario?: string | null;
  domain?: string | null;
  counterparty?: string | null;
};

export function logRisk(input: LogRiskInput): void {
  db()
    .prepare(
      `INSERT INTO risk_logs
        (wallet, session_id, risk_score, reasons, scenario, domain, counterparty, timestamp, outcome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .run(
      input.wallet,
      input.sessionId,
      input.riskScore,
      JSON.stringify(input.findings),
      input.scenario ?? null,
      input.domain ?? null,
      input.counterparty ?? null,
      Date.now(),
    );
}

export function setOutcome(sessionId: string, outcome: RiskOutcome): boolean {
  const result = db()
    .prepare(`UPDATE risk_logs SET outcome = ? WHERE session_id = ?`)
    .run(outcome, sessionId);
  return result.changes > 0;
}

export function getRecentRiskLogs(wallet: string, limit = 50): RiskLogRow[] {
  const rows = db()
    .prepare(
      `SELECT * FROM risk_logs WHERE wallet = ? ORDER BY timestamp DESC LIMIT ?`,
    )
    .all(wallet, limit) as RawRiskLogRow[];
  return rows.map(hydrate);
}
