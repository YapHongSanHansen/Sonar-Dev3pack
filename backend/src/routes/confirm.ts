import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { consumeSession } from '../modules/cooldown.js';

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  wallet: z.string().min(32).max(44),
  confirmToken: z.string().uuid(),
});

const reasonStatus: Record<string, number> = {
  not_found: 404,
  wallet_mismatch: 403,
  cooldown_active: 409,
  not_acknowledged: 412,
  invalid_token: 401,
  token_expired: 410,
  too_many_attempts: 429,
};

export async function confirmRoute(fastify: FastifyInstance) {
  fastify.post('/confirm', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_payload', issues: parsed.error.issues });
    }
    const { sessionId, wallet, confirmToken } = parsed.data;

    const result = consumeSession(sessionId, wallet, confirmToken);
    if (!result.ok) {
      return reply.code(reasonStatus[result.reason] ?? 400).send({ error: result.reason });
    }

    return {
      ok: true,
      message: 'Confirmation accepted. The dApp may now sign the transaction.',
      sessionId,
    };
  });
}
