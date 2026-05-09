import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getJsonBody, methodNotAllowed } from '../../lib/http.js';
import { getSession } from '../../lib/modules/cooldown.js';
import { voiceProvider } from '../../lib/modules/voice.js';

const schema = z.object({ sessionId: z.string().uuid() });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const parsed = schema.safeParse(getJsonBody(req));
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  try {
    const entry = await getSession(parsed.data.sessionId);
    if (!entry) return res.status(404).json({ error: 'session_not_found' });

    const audio = await voiceProvider.generate(entry.verdict.voiceScript, parsed.data.sessionId);
    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'private, max-age=300');
    return res.status(200).send(audio);
  } catch (err) {
    console.error('[/api/voice/generate]', err);
    return res.status(502).json({ error: 'voice_generation_failed', message: String(err) });
  }
}
