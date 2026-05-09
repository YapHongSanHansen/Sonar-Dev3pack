import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getSession } from '../modules/cooldown.js';
import { voiceProvider } from '../modules/voice.js';

const generateSchema = z.object({ sessionId: z.string().uuid() });

async function streamAudio(
  request: FastifyRequest,
  reply: FastifyReply,
  sessionId: string,
) {
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
}

export async function voiceRoute(fastify: FastifyInstance) {
  // Streaming GET — convenient for <audio src="…"> in browsers.
  fastify.get<{ Params: { sessionId: string } }>('/voice/:sessionId', async (request, reply) => {
    return streamAudio(request, reply, request.params.sessionId);
  });

  // Programmatic POST — same audio bytes, takes sessionId in the body.
  fastify.post('/voice/generate', async (request, reply) => {
    const parsed = generateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
    return streamAudio(request, reply, parsed.data.sessionId);
  });
}
