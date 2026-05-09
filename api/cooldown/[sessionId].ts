import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStatus } from '../../lib/modules/cooldown.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const sessionId = String(req.query.sessionId ?? '');
  if (!sessionId) return res.status(400).json({ error: 'session_id_required' });

  try {
    const status = await getStatus(sessionId);
    if (!status) return res.status(404).json({ error: 'session_not_found' });
    return res.status(200).json(status);
  } catch (err) {
    console.error('[/api/cooldown/:sessionId]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
