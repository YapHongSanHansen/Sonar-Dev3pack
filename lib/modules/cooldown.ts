import { randomUUID } from 'node:crypto';
import { supabase } from '../db/client.js';
import type { CooldownEntry, CooldownStatus, RiskVerdict } from '../types.js';

const CONFIRM_TOKEN_TTL_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_GRACE_MS = 5 * 60 * 1000;

type Row = {
  session_id: string;
  wallet: string;
  expires_at: number;
  acknowledged_at: number | null;
  confirm_token: string | null;
  confirm_token_expires_at: number | null;
  attempts: number;
  verdict: RiskVerdict;
};

function rowToEntry(r: Row): CooldownEntry {
  return {
    sessionId: r.session_id,
    wallet: r.wallet,
    expiresAt: r.expires_at,
    acknowledgedAt: r.acknowledged_at,
    confirmToken: r.confirm_token,
    confirmTokenExpiresAt: r.confirm_token_expires_at,
    attempts: r.attempts,
    verdict: r.verdict,
  };
}

export async function startCooldown(
  verdict: RiskVerdict,
  wallet: string,
): Promise<CooldownEntry> {
  const row: Row = {
    session_id: verdict.sessionId,
    wallet,
    expires_at: Date.now() + verdict.cooldownSeconds * 1000,
    acknowledged_at: null,
    confirm_token: null,
    confirm_token_expires_at: null,
    attempts: 0,
    verdict,
  };
  const { error } = await supabase().from('cooldown_sessions').insert(row);
  if (error) throw new Error(`startCooldown(${verdict.sessionId}): ${error.message}`);
  return rowToEntry(row);
}

export async function getSession(sessionId: string): Promise<CooldownEntry | null> {
  const { data, error } = await supabase()
    .from('cooldown_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw new Error(`getSession(${sessionId}): ${error.message}`);
  return data ? rowToEntry(data as Row) : null;
}

export async function getStatus(sessionId: string): Promise<CooldownStatus | null> {
  const entry = await getSession(sessionId);
  if (!entry) return null;
  const now = Date.now();
  const remainingMs = Math.max(0, entry.expiresAt - now);
  return {
    sessionId,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    cooldownPassed: remainingMs === 0,
    acknowledged: entry.acknowledgedAt != null,
    attempts: entry.attempts,
    expired: now > entry.expiresAt + SESSION_GRACE_MS,
  };
}

export type AckResult =
  | { ok: true; confirmToken: string; expiresAt: number }
  | { ok: false; reason: 'not_found' | 'wallet_mismatch' | 'cooldown_active' | 'too_many_attempts' };

export async function acknowledgeSession(
  sessionId: string,
  wallet: string,
): Promise<AckResult> {
  const entry = await getSession(sessionId);
  if (!entry) return { ok: false, reason: 'not_found' };
  if (entry.wallet !== wallet) {
    await bumpAttempts(sessionId, entry.attempts + 1);
    return { ok: false, reason: 'wallet_mismatch' };
  }
  if (entry.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
  if (Date.now() < entry.expiresAt) return { ok: false, reason: 'cooldown_active' };

  const now = Date.now();
  const needsNewToken =
    !entry.confirmToken || (entry.confirmTokenExpiresAt ?? 0) < now;
  const confirmToken = needsNewToken ? randomUUID() : entry.confirmToken!;
  const confirmTokenExpiresAt = needsNewToken
    ? now + CONFIRM_TOKEN_TTL_MS
    : entry.confirmTokenExpiresAt!;
  const acknowledgedAt = entry.acknowledgedAt ?? now;

  const { error } = await supabase()
    .from('cooldown_sessions')
    .update({
      confirm_token: confirmToken,
      confirm_token_expires_at: confirmTokenExpiresAt,
      acknowledged_at: acknowledgedAt,
    })
    .eq('session_id', sessionId);
  if (error) throw new Error(`acknowledgeSession(${sessionId}): ${error.message}`);

  return { ok: true, confirmToken, expiresAt: confirmTokenExpiresAt };
}

export type ConsumeResult =
  | { ok: true; entry: CooldownEntry }
  | {
      ok: false;
      reason:
        | 'not_found'
        | 'wallet_mismatch'
        | 'cooldown_active'
        | 'not_acknowledged'
        | 'invalid_token'
        | 'token_expired'
        | 'too_many_attempts';
    };

export async function consumeSession(
  sessionId: string,
  wallet: string,
  confirmToken: string,
): Promise<ConsumeResult> {
  const entry = await getSession(sessionId);
  if (!entry) return { ok: false, reason: 'not_found' };
  if (entry.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
  if (entry.wallet !== wallet) {
    await bumpAttempts(sessionId, entry.attempts + 1);
    return { ok: false, reason: 'wallet_mismatch' };
  }
  if (Date.now() < entry.expiresAt) {
    await bumpAttempts(sessionId, entry.attempts + 1);
    return { ok: false, reason: 'cooldown_active' };
  }
  if (!entry.acknowledgedAt) return { ok: false, reason: 'not_acknowledged' };
  if (!entry.confirmToken || entry.confirmToken !== confirmToken) {
    await bumpAttempts(sessionId, entry.attempts + 1);
    return { ok: false, reason: 'invalid_token' };
  }
  if ((entry.confirmTokenExpiresAt ?? 0) < Date.now()) {
    return { ok: false, reason: 'token_expired' };
  }

  const { error } = await supabase()
    .from('cooldown_sessions')
    .delete()
    .eq('session_id', sessionId);
  if (error) throw new Error(`consumeSession(${sessionId}): ${error.message}`);

  return { ok: true, entry };
}

async function bumpAttempts(sessionId: string, next: number): Promise<void> {
  await supabase()
    .from('cooldown_sessions')
    .update({ attempts: next })
    .eq('session_id', sessionId);
}
