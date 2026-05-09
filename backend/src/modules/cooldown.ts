import { randomUUID } from 'node:crypto';
import type { CooldownEntry, CooldownStatus, RiskVerdict } from '../types.js';

const sessions = new Map<string, CooldownEntry>();
const CONFIRM_TOKEN_TTL_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_GRACE_MS = 5 * 60 * 1000;

export function startCooldown(verdict: RiskVerdict, wallet: string): CooldownEntry {
  const entry: CooldownEntry = {
    wallet,
    sessionId: verdict.sessionId,
    expiresAt: Date.now() + verdict.cooldownSeconds * 1000,
    acknowledgedAt: null,
    confirmToken: null,
    confirmTokenExpiresAt: null,
    attempts: 0,
    verdict,
  };
  sessions.set(verdict.sessionId, entry);
  return entry;
}

export function getSession(sessionId: string): CooldownEntry | undefined {
  return sessions.get(sessionId);
}

export function getStatus(sessionId: string): CooldownStatus | null {
  const entry = sessions.get(sessionId);
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

export function isCooldownPassed(sessionId: string): boolean {
  const entry = sessions.get(sessionId);
  if (!entry) return false;
  return Date.now() >= entry.expiresAt;
}

export type AckResult =
  | { ok: true; confirmToken: string; expiresAt: number }
  | { ok: false; reason: 'not_found' | 'wallet_mismatch' | 'cooldown_active' | 'too_many_attempts' };

export function acknowledgeSession(sessionId: string, wallet: string): AckResult {
  const entry = sessions.get(sessionId);
  if (!entry) return { ok: false, reason: 'not_found' };
  if (entry.wallet !== wallet) {
    entry.attempts++;
    return { ok: false, reason: 'wallet_mismatch' };
  }
  if (entry.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
  if (Date.now() < entry.expiresAt) return { ok: false, reason: 'cooldown_active' };

  if (!entry.confirmToken || (entry.confirmTokenExpiresAt ?? 0) < Date.now()) {
    entry.confirmToken = randomUUID();
    entry.confirmTokenExpiresAt = Date.now() + CONFIRM_TOKEN_TTL_MS;
  }
  entry.acknowledgedAt = entry.acknowledgedAt ?? Date.now();
  return { ok: true, confirmToken: entry.confirmToken, expiresAt: entry.confirmTokenExpiresAt! };
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

export function consumeSession(
  sessionId: string,
  wallet: string,
  confirmToken: string,
): ConsumeResult {
  const entry = sessions.get(sessionId);
  if (!entry) return { ok: false, reason: 'not_found' };
  if (entry.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
  if (entry.wallet !== wallet) {
    entry.attempts++;
    return { ok: false, reason: 'wallet_mismatch' };
  }
  if (Date.now() < entry.expiresAt) {
    entry.attempts++;
    return { ok: false, reason: 'cooldown_active' };
  }
  if (!entry.acknowledgedAt) return { ok: false, reason: 'not_acknowledged' };
  if (!entry.confirmToken || entry.confirmToken !== confirmToken) {
    entry.attempts++;
    return { ok: false, reason: 'invalid_token' };
  }
  if ((entry.confirmTokenExpiresAt ?? 0) < Date.now()) {
    return { ok: false, reason: 'token_expired' };
  }
  sessions.delete(sessionId);
  return { ok: true, entry };
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now > entry.expiresAt + SESSION_GRACE_MS) sessions.delete(id);
  }
}, 60 * 1000).unref();

export const __test = {
  reset: () => sessions.clear(),
  size: () => sessions.size,
};
