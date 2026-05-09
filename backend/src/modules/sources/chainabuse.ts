import { config } from '../../config.js';

const cache = new Map<string, { count: number | null; at: number }>();
const TTL_MS = 60 * 60 * 1000;

const authHeader =
  'Basic ' + Buffer.from(`${config.CHAINABUSE_API_KEY}:`).toString('base64');

export async function getScamReportCount(
  address: string,
  chain: 'SOL' = 'SOL',
): Promise<number | null> {
  const cached = cache.get(address);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.count;

  try {
    const url =
      `https://api.chainabuse.com/v0/reports` +
      `?address=${encodeURIComponent(address)}` +
      `&chain=${chain}` +
      `&perPage=1`;
    const res = await fetch(url, {
      headers: { authorization: authHeader, accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Chainabuse → ${res.status}`);
    const json = (await res.json()) as { count?: number };
    const count = typeof json.count === 'number' ? json.count : 0;
    cache.set(address, { count, at: Date.now() });
    return count;
  } catch {
    return null;
  }
}
