import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chainabuseKeyCount } from '../lib/modules/sources/chainabuse.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const chainabuseKeys = chainabuseKeyCount();
  return res.status(200).json({
    ok: true,
    runtime: process.version,
    has_elevenlabs_key: !!process.env.ELEVENLABS_API_KEY,
    has_helius_key: !!process.env.HELIUS_API_KEY,
    has_chainabuse_key: chainabuseKeys > 0,
    chainabuse_key_slots: chainabuseKeys,
    has_whoisxml_key: !!process.env.WHOISXML_API_KEY,
    network: process.env.SOLANA_NETWORK ?? 'unset',
  });
}
