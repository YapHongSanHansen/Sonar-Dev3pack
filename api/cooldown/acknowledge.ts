import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getJsonBody, methodNotAllowed } from '../../lib/http.js';
import { acknowledgeSession } from '../../lib/modules/cooldown.js';

const schema = z.object({ wallet: z.string().min(32).max(44) });

const reasonStatus: Record<string, number> = {
  not_found: 404,
  wallet_mismatch: 403,
  cooldown_active: 409,
  too_many_attempts: 429,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const sessionId = String(req.query.sessionId ?? '');
  if (!sessionId) return res.status(400).json({ error: 'session_id_required' });

  const parsed = schema.safeParse(getJsonBody(req));
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  try {
    const result = await acknowledgeSession(sessionId, parsed.data.wallet);
    if (!result.ok) {
      return res.status(reasonStatus[result.reason] ?? 400).json({ error: result.reason });
    }
    return res.status(200).json({
      ok: true,
      confirmToken: result.confirmToken,
      confirmTokenExpiresAt: result.expiresAt,
    });
  } catch (err) {
    console.error('[/api/cooldown/acknowledge]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
