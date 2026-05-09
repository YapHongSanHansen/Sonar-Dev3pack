import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getUser, setRiskPreferences } from '../db/users.js';
import { getRecentRiskLogs } from '../db/riskLogs.js';
import { getBehavioral } from '../db/behavioral.js';

const walletParam = z.object({ wallet: z.string().min(32).max(44) });
const limitQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(50) });

export async function usersRoute(fastify: FastifyInstance) {
  fastify.get<{ Params: { wallet: string } }>('/users/:wallet', async (request, reply) => {
    const parsed = walletParam.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_wallet' });
    const user = getUser(parsed.data.wallet);
    if (!user) return reply.code(404).send({ error: 'user_not_found' });
    return user;
  });

  fastify.put<{ Params: { wallet: string } }>(
    '/users/:wallet/preferences',
    async (request, reply) => {
      const parsed = walletParam.safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_wallet' });
      const prefs = z.record(z.unknown()).safeParse(request.body);
      if (!prefs.success) return reply.code(400).send({ error: 'invalid_preferences' });
      const updated = setRiskPreferences(parsed.data.wallet, prefs.data);
      if (!updated) return reply.code(404).send({ error: 'user_not_found' });
      return updated;
    },
  );

  fastify.get<{ Params: { wallet: string }; Querystring: { limit?: number } }>(
    '/users/:wallet/risk-logs',
    async (request, reply) => {
      const parsed = walletParam.safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_wallet' });
      const q = limitQuery.safeParse(request.query);
      if (!q.success) return reply.code(400).send({ error: 'invalid_query' });
      return { logs: getRecentRiskLogs(parsed.data.wallet, q.data.limit) };
    },
  );

  fastify.get<{ Params: { wallet: string } }>(
    '/users/:wallet/baseline',
    async (request, reply) => {
      const parsed = walletParam.safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_wallet' });
      const baseline = getBehavioral(parsed.data.wallet);
      if (!baseline) return reply.code(404).send({ error: 'baseline_not_found' });
      return baseline;
    },
  );
}
