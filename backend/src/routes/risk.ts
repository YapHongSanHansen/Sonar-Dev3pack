import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { parseInterceptorPayload } from '../modules/interceptor.js';
import { gather } from '../modules/simulator.js';
import { score, cooldownFor } from '../modules/scorer.js';
import { startCooldown } from '../modules/cooldown.js';
import { buildVoiceScript } from '../modules/voice.js';
import { ensureUser } from '../db/users.js';
import { logRisk } from '../db/riskLogs.js';
import type { RiskVerdict } from '../types.js';

export async function riskRoute(fastify: FastifyInstance) {
  fastify.post('/risk', async (request, reply) => {
    let payload;
    try {
      payload = parseInterceptorPayload(request.body);
    } catch (err) {
      return reply.code(400).send({ error: 'invalid_payload', details: String(err) });
    }

    ensureUser(payload.wallet);

    const { sim, ctx } = await gather(payload);
    const { score: riskScore, findings } = score(sim, ctx, payload);
    const cooldownSeconds = cooldownFor(riskScore);
    const sessionId = randomUUID();
    const voiceScript = buildVoiceScript(findings, riskScore, sessionId);

    const verdict: RiskVerdict = {
      riskRequired: riskScore >= 40,
      score: riskScore,
      cooldownSeconds,
      sim,
      ctx,
      findings,
      voiceScript,
      sessionId,
    };

    logRisk({
      wallet: payload.wallet,
      sessionId,
      riskScore,
      findings,
      scenario: payload.scenario ?? null,
      domain: ctx.domain,
      counterparty: ctx.counterparty,
    });

    if (verdict.riskRequired) startCooldown(verdict, payload.wallet);

    return verdict;
  });
}
