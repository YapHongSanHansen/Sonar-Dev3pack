import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { config } from './config.js';
import { riskRoute } from './routes/risk.js';
import { confirmRoute } from './routes/confirm.js';
import { cooldownRoute } from './routes/cooldown.js';
import { voiceRoute } from './routes/voice.js';
import { usersRoute } from './routes/users.js';
import { db } from './db/index.js';

const fastify = Fastify({
  logger: { transport: { target: 'pino-pretty', options: { colorize: true } } },
});

await fastify.register(cors, { origin: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendPath = join(__dirname, '../../frontend');
await fastify.register(staticPlugin, { root: frontendPath, prefix: '/' });

db(); // open + run migrations before any request lands

await fastify.register(riskRoute);
await fastify.register(confirmRoute);
await fastify.register(cooldownRoute);
await fastify.register(voiceRoute);
await fastify.register(usersRoute);

fastify.get('/health', async () => ({ ok: true, network: config.SOLANA_NETWORK }));

try {
  await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
  fastify.log.info(`SONAR backend listening on http://localhost:${config.PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
