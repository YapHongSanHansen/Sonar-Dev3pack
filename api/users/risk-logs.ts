import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getRecentRiskLogs } from '../../lib/db/riskLogs.js';

const walletSchema = z.string().min(32).max(44);
const limitSchema = z.coerce.number().int().min(1).max(500).default(50);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const wallet = walletSchema.safeParse(req.query.wallet);
  if (!wallet.success) return res.status(400).json({ error: 'invalid_wallet' });
  const limit = limitSchema.safeParse(req.query.limit);
  if (!limit.success) return res.status(400).json({ error: 'invalid_query' });

  try {
    const logs = await getRecentRiskLogs(wallet.data, limit.data);
    return res.status(200).json({ logs });
  } catch (err) {
    console.error('[/api/users/risk-logs]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
