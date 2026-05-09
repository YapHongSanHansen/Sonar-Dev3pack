import { db } from './index.js';

export type UserRow = {
  wallet_address: string;
  created_at: number;
  updated_at: number;
  risk_preferences: Record<string, unknown>;
};

type RawUserRow = {
  wallet_address: string;
  created_at: number;
  updated_at: number;
  risk_preferences: string;
};

function hydrate(row: RawUserRow): UserRow {
  return { ...row, risk_preferences: JSON.parse(row.risk_preferences) };
}

export function ensureUser(wallet: string): UserRow {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO users (wallet_address, created_at, updated_at, risk_preferences)
       VALUES (?, ?, ?, '{}')
       ON CONFLICT(wallet_address) DO UPDATE SET updated_at = excluded.updated_at`,
    )
    .run(wallet, now, now);
  return getUser(wallet)!;
}

export function getUser(wallet: string): UserRow | null {
  const row = db()
    .prepare('SELECT * FROM users WHERE wallet_address = ?')
    .get(wallet) as RawUserRow | undefined;
  return row ? hydrate(row) : null;
}

export function setRiskPreferences(
  wallet: string,
  prefs: Record<string, unknown>,
): UserRow | null {
  const now = Date.now();
  const result = db()
    .prepare(
      `UPDATE users SET risk_preferences = ?, updated_at = ? WHERE wallet_address = ?`,
    )
    .run(JSON.stringify(prefs), now, wallet);
  if (result.changes === 0) return null;
  return getUser(wallet);
}
