// Static known-malicious Solana addresses. Edit this file directly to add
// entries — bundling at build time keeps it portable across Vercel's
// serverless functions where loose JSON next to the source isn't shipped.
//
// Sources to seed from: Phantom blocklist, Solflare drainer list,
// ScamSniffer, GoPlus security, your own incident reports.

export type KnownBadEntry = {
  source: string;
  tags?: string[];
  note?: string;
};

export const KNOWN_BAD: Record<string, KnownBadEntry> = {
  // "AddressInBase58Here": { source: "phantom-blocklist", tags: ["drainer"] },
};
