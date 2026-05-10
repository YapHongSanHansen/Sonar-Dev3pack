import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export type KnownBadHit = {
  source: string;
  tags: string[];
  note: string | null;
};

type Entry = { source?: string; tags?: string[]; note?: string };
type File = { addresses?: Record<string, Entry> };

const dataPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'knownBad.json',
);

let table: Map<string, KnownBadHit> | null = null;

function load(): Map<string, KnownBadHit> {
  if (table) return table;
  const t = new Map<string, KnownBadHit>();
  try {
    const raw = JSON.parse(readFileSync(dataPath, 'utf8')) as File;
    for (const [addr, meta] of Object.entries(raw.addresses ?? {})) {
      t.set(addr, {
        source: meta.source ?? 'local',
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        note: meta.note ?? null,
      });
    }
  } catch (err) {
    console.error('[knownBad] failed to load list:', err);
  }
  table = t;
  return t;
}

export function isKnownMalicious(address: string | null | undefined): KnownBadHit | null {
  if (!address) return null;
  return load().get(address) ?? null;
}

export function knownBadCount(): number {
  return load().size;
}
