import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getJsonBody, methodNotAllowed } from '../../lib/http.js';
import { getSession, getStatus } from '../../lib/modules/cooldown.js';

const schema = z.object({
  sessionId: z.string().uuid(),
  wallet: z.string().min(32).max(44),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const parsed = schema.safeParse(getJsonBody(req));
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  try {
    const entry = await getSession(parsed.data.sessionId);
    if (!entry) return res.status(404).json({ error: 'session_not_found' });
    if (entry.wallet !== parsed.data.wallet) {
      return res.status(403).json({ error: 'wallet_mismatch' });
    }
    const status = await getStatus(parsed.data.sessionId);
    return res.status(200).json(status);
  } catch (err) {
    console.error('[/api/cooldown/start]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
