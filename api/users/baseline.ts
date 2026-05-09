import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getBehavioral } from '../../lib/db/behavioral.js';

const walletSchema = z.string().min(32).max(44);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const wallet = walletSchema.safeParse(req.query.wallet);
  if (!wallet.success) return res.status(400).json({ error: 'invalid_wallet' });

  try {
    const baseline = await getBehavioral(wallet.data);
    if (!baseline) return res.status(404).json({ error: 'baseline_not_found' });
    return res.status(200).json(baseline);
  } catch (err) {
    console.error('[/api/users/baseline]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
