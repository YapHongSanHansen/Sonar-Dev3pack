import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getUser } from '../../lib/db/users.js';

const schema = z.object({ wallet: z.string().min(32).max(44) });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const parsed = schema.safeParse({ wallet: req.query.wallet });
  if (!parsed.success) return res.status(400).json({ error: 'invalid_wallet' });

  try {
    const user = await getUser(parsed.data.wallet);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    return res.status(200).json(user);
  } catch (err) {
    console.error('[/api/users/:wallet]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
