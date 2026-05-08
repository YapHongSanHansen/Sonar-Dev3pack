import type { FastifyInstance } from 'fastify';
import { getSession } from '../modules/cooldown.js';
import { voiceProvider } from '../modules/voice.js';

export async function voiceRoute(fastify: FastifyInstance) {
  fastify.get<{ Params: { sessionId: string } }>('/voice/:sessionId', async (request, reply) => {
    const { sessionId } = request.params;
    const entry = getSession(sessionId);
    if (!entry) return reply.code(404).send({ error: 'session_not_found' });

    try {
      const audio = await voiceProvider.generate(entry.verdict.voiceScript, sessionId);
      return reply
        .type('audio/mpeg')
        .header('cache-control', 'private, max-age=300')
        .send(audio);
    } catch (err) {
      request.log.error({ err }, 'voice generation failed');
      return reply.code(502).send({ error: 'voice_generation_failed', message: String(err) });
    }
  });
}
