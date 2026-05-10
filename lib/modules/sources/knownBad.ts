import { KNOWN_BAD } from './knownBadData.js';

export type KnownBadHit = {
  source: string;
  tags: string[];
  note: string | null;
};

let table: Map<string, KnownBadHit> | null = null;

function load(): Map<string, KnownBadHit> {
  if (table) return table;
  const t = new Map<string, KnownBadHit>();
  for (const [addr, meta] of Object.entries(KNOWN_BAD)) {
    t.set(addr, {
      source: meta.source ?? 'local',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      note: meta.note ?? null,
    });
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
