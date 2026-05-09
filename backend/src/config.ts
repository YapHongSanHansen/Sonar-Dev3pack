import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  ELEVENLABS_API_KEY: z.string().min(1, 'ELEVENLABS_API_KEY is required — copy .env.example to .env and fill it in'),
  ELEVENLABS_VOICE_ID: z.string().default('21m00Tcm4TlvDq8ikWAM'),
  ELEVENLABS_AGENT_ID: z.string().optional(),
  SOLANA_NETWORK: z.enum(['devnet', 'mainnet-beta', 'testnet']).default('devnet'),
  HELIUS_API_KEY: z.string().min(1, 'HELIUS_API_KEY is required for wallet age + interaction history'),
  WHOISXML_API_KEY: z.string().min(1, 'WHOISXML_API_KEY is required for domain age lookups'),
  CHAINABUSE_API_KEY: z.string().min(1, 'CHAINABUSE_API_KEY is required for scam report lookups'),
  DATABASE_PATH: z.string().default('./data/sonar.db'),
  PORT: z.coerce.number().default(3000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n[config] Invalid environment:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nFix .env and restart.\n');
  process.exit(1);
}

export const config = parsed.data;
