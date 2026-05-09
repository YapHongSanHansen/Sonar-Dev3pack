import { config } from '../../config.js';

const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${config.HELIUS_API_KEY}`;
const PARSED_TX_URL = (addr: string) =>
  `https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${config.HELIUS_API_KEY}&limit=100`;

const ageCache = new Map<string, { ageDays: number | null; at: number }>();
const interactionCache = new Map<string, { hit: boolean; at: number }>();
const TTL_MS = 60 * 60 * 1000;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Helius RPC ${method} → ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`Helius RPC ${method}: ${json.error.message}`);
  return json.result as T;
}

export async function getWalletAgeDays(address: string): Promise<number | null> {
  const cached = ageCache.get(address);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.ageDays;

  try {
    let oldestBlockTime: number | null = null;
    let before: string | undefined;
    let reachedBottom = false;

    for (let i = 0; i < 5; i++) {
      const sigs = await rpc<Array<{ signature: string; blockTime: number | null }>>(
        'getSignaturesForAddress',
        [address, { limit: 1000, before }],
      );
      if (sigs.length === 0) {
        reachedBottom = true;
        break;
      }
      const last = sigs[sigs.length - 1];
      if (last.blockTime != null) oldestBlockTime = last.blockTime;
      if (sigs.length < 1000) {
        reachedBottom = true;
        break;
      }
      before = last.signature;
    }

    // If pagination ran out of pages without hitting the bottom, the address is
    // too active to determine birthdate cheaply. Treat as "old enough" (null =
    // skip the rule) rather than reporting a misleadingly recent age.
    const ageDays =
      reachedBottom && oldestBlockTime != null
        ? Math.floor((Date.now() / 1000 - oldestBlockTime) / 86400)
        : null;
    ageCache.set(address, { ageDays, at: Date.now() });
    return ageDays;
  } catch {
    ageCache.set(address, { ageDays: null, at: Date.now() });
    return null;
  }
}

export async function hasPriorInteraction(
  userWallet: string,
  counterparty: string,
): Promise<boolean | null> {
  const key = `${userWallet}::${counterparty}`;
  const cached = interactionCache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.hit;

  try {
    const res = await fetch(PARSED_TX_URL(userWallet), {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Helius parsed-tx → ${res.status}`);
    const txs = (await res.json()) as Array<{ accountData?: Array<{ account: string }> }>;
    const hit = txs.some((tx) =>
      (tx.accountData ?? []).some((a) => a.account === counterparty),
    );
    interactionCache.set(key, { hit, at: Date.now() });
    return hit;
  } catch {
    return null;
  }
}
