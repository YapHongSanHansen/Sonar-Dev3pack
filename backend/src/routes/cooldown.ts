import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { acknowledgeSession, getStatus } from '../modules/cooldown.js';

const ackSchema = z.object({ wallet: z.string().min(32).max(44) });

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
