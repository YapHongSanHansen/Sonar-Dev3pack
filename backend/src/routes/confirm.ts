import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { consumeSession, isCooldownPassed } from '../modules/cooldown.js';

const bodySchema = z.object({ sessionId: z.string().uuid() });

export async function confirmRoute(fastify: FastifyInstance) {
  fastify.post('/confirm', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_payload' });
    }
    const { sessionId } = parsed.data;

    if (!isCooldownPassed(sessionId)) {
      return reply.code(409).send({ error: 'cooldown_active', message: 'Cooldown has not expired.' });
    }

    const entry = consumeSession(sessionId);
    if (!entry) {
      return reply.code(404).send({ error: 'session_not_found' });
    }

    return { ok: true, message: 'Confirmation accepted. The dApp may now sign the transaction.' };
  });
}
