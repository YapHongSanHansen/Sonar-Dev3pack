import type { VercelRequest, VercelResponse } from '@vercel/node';
import { config } from '../lib/config.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    return res.status(200).json({ ok: true, network: config.SOLANA_NETWORK });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
