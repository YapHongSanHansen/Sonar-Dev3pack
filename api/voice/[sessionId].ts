import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSession } from '../../lib/modules/cooldown.js';
import { voiceProvider } from '../../lib/modules/voice.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const sessionId = String(req.query.sessionId ?? '');
  if (!sessionId) return res.status(400).json({ error: 'session_id_required' });

  try {
    const entry = await getSession(sessionId);
    if (!entry) return res.status(404).json({ error: 'session_not_found' });

    const audio = await voiceProvider.generate(entry.verdict.voiceScript, sessionId);
    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'private, max-age=300');
    return res.status(200).send(audio);
  } catch (err) {
    console.error('[/api/voice/:sessionId]', err);
    return res.status(502).json({ error: 'voice_generation_failed', message: String(err) });
  }
}
