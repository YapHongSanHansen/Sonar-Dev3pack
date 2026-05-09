import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getJsonBody, methodNotAllowed } from '../../lib/http.js';
import { setRiskPreferences } from '../../lib/db/users.js';

const walletSchema = z.string().min(32).max(44);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') return methodNotAllowed(res, ['PUT']);

  const wallet = walletSchema.safeParse(req.query.wallet);
  if (!wallet.success) return res.status(400).json({ error: 'invalid_wallet' });

  const prefs = z.record(z.unknown()).safeParse(getJsonBody(req));
  if (!prefs.success) return res.status(400).json({ error: 'invalid_preferences' });

  try {
    const updated = await setRiskPreferences(wallet.data, prefs.data);
    if (!updated) return res.status(404).json({ error: 'user_not_found' });
    return res.status(200).json(updated);
  } catch (err) {
    console.error('[/api/users/preferences]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
