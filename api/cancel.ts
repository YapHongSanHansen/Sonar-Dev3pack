import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getJsonBody, methodNotAllowed } from '../lib/http.js';
import { setOutcome } from '../lib/db/riskLogs.js';

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  wallet: z.string().min(32).max(44),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const parsed = bodySchema.safeParse(getJsonBody(req));
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  try {
    await setOutcome(parsed.data.sessionId, 'cancelled');
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[/api/cancel]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
