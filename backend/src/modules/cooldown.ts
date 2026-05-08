import type { CooldownEntry, RiskVerdict } from '../types.js';

const sessions = new Map<string, CooldownEntry>();

export function startCooldown(verdict: RiskVerdict): CooldownEntry {
  const entry: CooldownEntry = {
    wallet: verdict.sim.programIds[0] ?? '',
    sessionId: verdict.sessionId,
    expiresAt: Date.now() + verdict.cooldownSeconds * 1000,
    verdict,
  };
  sessions.set(verdict.sessionId, entry);
  return entry;
}

export function getSession(sessionId: string): CooldownEntry | undefined {
  return sessions.get(sessionId);
}

export function isCooldownPassed(sessionId: string): boolean {
  const entry = sessions.get(sessionId);
  if (!entry) return false;
  return Date.now() >= entry.expiresAt;
}

export function consumeSession(sessionId: string): CooldownEntry | undefined {
  const entry = sessions.get(sessionId);
  if (entry) sessions.delete(sessionId);
  return entry;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now > entry.expiresAt + 5 * 60 * 1000) sessions.delete(id);
  }
}, 60 * 1000).unref();
