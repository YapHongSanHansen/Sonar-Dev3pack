import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { acknowledgeSession, getSession, getStatus } from '../modules/cooldown.js';

const ackSchema = z.object({ wallet: z.string().min(32).max(44) });
const startSchema = z.object({
  sessionId: z.string().uuid(),
  wallet: z.string().min(32).max(44),
});

const reasonStatus: Record<string, number> = {
  not_found: 404,
  wallet_mismatch: 403,
  cooldown_active: 409,
  too_many_attempts: 429,
};

export async function cooldownRoute(fastify: FastifyInstance) {
  fastify.get<{ Params: { sessionId: string } }>(
    '/cooldown/:sessionId',
    async (request, reply) => {
      const status = getStatus(request.params.sessionId);
      if (!status) return reply.code(404).send({ error: 'session_not_found' });
      return status;
    },
  );

  // Wallet-authenticated cooldown entry. Same response shape as GET above, but
  // requires {sessionId, wallet} in the body so a leaked sessionId alone can't
  // be used to read state from another user's session.
  fastify.post('/cooldown/start', async (request, reply) => {
    const parsed = startSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload' });
    const entry = getSession(parsed.data.sessionId);
    if (!entry) return reply.code(404).send({ error: 'session_not_found' });
    if (entry.wallet !== parsed.data.wallet) {
      return reply.code(403).send({ error: 'wallet_mismatch' });
    }
    const status = getStatus(parsed.data.sessionId);
    return status;
  });

  fastify.post<{ Params: { sessionId: string } }>(
    '/cooldown/:sessionId/acknowledge',
    async (request, reply) => {
      const parsed = ackSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_payload' });
      }
      const result = acknowledgeSession(request.params.sessionId, parsed.data.wallet);
      if (!result.ok) {
        return reply.code(reasonStatus[result.reason] ?? 400).send({ error: result.reason });
      }
      return {
        ok: true,
        confirmToken: result.confirmToken,
        confirmTokenExpiresAt: result.expiresAt,
      };
    },
  );
}
