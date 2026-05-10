const cache = new Map<string, { count: number | null; at: number }>();
const TTL_MS = 60 * 60 * 1000;

// Chainabuse free tier is 10 req/key/month. Keys may come from either:
//   - numbered slots: CHAINABUSE_API_KEY_1, CHAINABUSE_API_KEY_2, …
//   - a comma-separated CHAINABUSE_API_KEY (kept for back-compat)
// All sources are merged and deduped. Each request advances the cursor
// (round-robin) so load is spread evenly across keys instead of burning
// through one before touching the next. Exhausted keys (429) are remembered
// for a day and skipped, so we don't keep hammering them within the same
// warm instance.
const EXHAUSTED_TTL_MS = 24 * 60 * 60 * 1000;
const exhausted = new Map<string, number>();
let cursor = 0;

function collectKeys(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | undefined) => {
    if (!raw) return;
    for (const part of raw.split(',')) {
      const k = part.trim();
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }
  };
  push(process.env.CHAINABUSE_API_KEY);
  for (const [name, val] of Object.entries(process.env)) {
    if (/^CHAINABUSE_API_KEY_\d+$/.test(name)) push(val);
  }
  return out;
}

function liveKeys(): string[] {
  const now = Date.now();
  return collectKeys().filter((k) => {
    const at = exhausted.get(k);
    if (at && now - at < EXHAUSTED_TTL_MS) return false;
    if (at) exhausted.delete(k);
    return true;
  });
}

export function chainabuseKeyCount(): number {
  return collectKeys().length;
}

export async function getScamReportCount(
  address: string,
  chain: 'SOL' = 'SOL',
): Promise<number | null> {
  const cached = cache.get(address);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.count;

  const url =
    `https://api.chainabuse.com/v0/reports` +
    `?address=${encodeURIComponent(address)}` +
    `&chain=${chain}` +
    `&perPage=1`;

  const fetchWith = async (key: string, password: string) => {
    const authHeader =
      'Basic ' + Buffer.from(`${key}:${password}`, 'utf8').toString('base64');
    return fetch(url, {
      headers: { authorization: authHeader, accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
  };

  const keys = liveKeys();
  if (keys.length === 0) return null;

  // Pin the starting slot for this request, then advance the global cursor
  // immediately so the *next* request uses the next key (round-robin).
  const start = cursor % keys.length;
  cursor = (start + 1) % keys.length;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(start + attempt) % keys.length];
    try {
      let res = await fetchWith(key, key);
      if (res.status === 401 || res.status === 403) {
        res = await fetchWith(key, '');
      }
      if (res.status === 429) {
        exhausted.set(key, Date.now());
        continue;
      }
      if (!res.ok) throw new Error(`Chainabuse → ${res.status}`);
      const json = (await res.json()) as {
        count?: number;
        total?: number;
        reports?: unknown[];
      };
      let count =
        typeof json.count === 'number'
          ? json.count
          : typeof json.total === 'number'
            ? json.total
            : Array.isArray(json.reports)
              ? json.reports.length
              : NaN;
      if (!Number.isFinite(count)) count = 0;
      cache.set(address, { count, at: Date.now() });
      return count;
    } catch {
      // network/timeout/non-2xx — fall through to next key as failover
    }
  }
  return null;
}
