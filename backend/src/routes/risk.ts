import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { parseInterceptorPayload } from '../modules/interceptor.js';
import { simulate } from '../modules/simulator.js';
import { score, cooldownFor } from '../modules/scorer.js';
import { startCooldown } from '../modules/cooldown.js';
import { buildVoiceScript } from '../modules/voice.js';
import type { RiskVerdict } from '../types.js';

export async function riskRoute(fastify: FastifyInstance) {
  fastify.post('/risk', async (request, reply) => {
    let payload;
    try {
      payload = parseInterceptorPayload(request.body);
    } catch (err) {
      return reply.code(400).send({ error: 'invalid_payload', details: String(err) });
    }

    const sim = await simulate(payload);
    const { score: riskScore, findings } = score(sim);
    const cooldownSeconds = cooldownFor(riskScore);
    const sessionId = randomUUID();
    const voiceScript = buildVoiceScript(findings);

    const verdict: RiskVerdict = {
      riskRequired: riskScore >= 40,
      score: riskScore,
      cooldownSeconds,
      sim,
      findings,
      voiceScript,
      sessionId,
    };

    if (verdict.riskRequired) startCooldown(verdict);

    return verdict;
  });
}
