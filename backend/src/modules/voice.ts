import type { RiskFinding, VoiceProvider } from '../types.js';
import { config } from '../config.js';

const OPENERS_HIGH = [
  'Yo, hold up. This one is bad.',
  'Real talk — do not sign this yet.',
  'OK, hard stop. Read this before you tap anything.',
  'Hey, no — pause. This is the kind of thing that drains wallets.',
];

const OPENERS_MED = [
  'Hey, hold on a sec.',
  'Wait — look at this before you sign.',
  'Pause for a second, something feels off.',
  'Heads up, a couple of red flags here.',
];

const OPENERS_LOW = [
  'Quick check before you sign.',
  'Heads up — nothing huge, but worth knowing.',
  'Just so you know what this does.',
];

const CONNECTORS = ['And ', 'Plus ', 'On top of that, ', 'Oh, and ', 'Also — '];

const CLOSERS_HIGH = [
  'If your gut is saying no, listen to it. Cancel this.',
  'When in doubt — and you should have doubt — just cancel.',
  "Honestly, almost nothing is worth this much risk. Cancel and walk away.",
];

const CLOSERS_MED = [
  "If anything feels off, cancel and verify on the project's real channels.",
  "When something looks weird, cancel first, ask questions later.",
  "Don't power through this one. Cancel and double-check.",
];

const CLOSERS_LOW = [
  'Take a sec. If it still looks fine after reading, you can go ahead.',
  "Quick gut check, then proceed if you're sure.",
];

function seededPick<T>(arr: readonly T[], seed: string, salt: string): T {
  let h = 0;
  const s = seed + salt;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

function ageWord(days: number): string {
  if (days <= 0) return 'literally hours ago';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${days} days ago — barely a month`;
  return `${days} days ago`;
}

type LineBuilder = (f: RiskFinding) => string;

const RULE_LINES: Record<string, LineBuilder> = {
  large_transfer: (f) => {
    const sol = (f.evidence?.sol as number | undefined) ?? null;
    return sol != null
      ? `it's sending ${sol} SOL out the door, which is a real chunk of money`
      : "the transfer amount is on the high side";
  },
  unlimited_approval: () =>
    "it's asking for unlimited access to your tokens — like, all of them, anytime, forever",
  unverified_program: () =>
    "the program isn't verified, so nobody really knows what it does under the hood",
  complex_transaction: (f) => {
    const n = (f.evidence?.count as number | undefined) ?? null;
    return n != null
      ? `it's touching ${n} different programs in one shot, which is unusual for a normal action`
      : "it's juggling a lot of programs at once";
  },
  fake_token_name: () =>
    "the token name is impersonating a real project — classic phishing bait",
  wallet_age: (f) => {
    const days = (f.evidence?.walletAgeDays as number | undefined) ?? null;
    return days != null
      ? `the address you'd be trusting was created ${ageWord(days)}`
      : "the address you'd be trusting is brand new";
  },
  no_prior_interaction: () =>
    "you've never interacted with this address before, ever",
  scam_reports: (f) => {
    const count = (f.evidence?.count as number | undefined) ?? null;
    if (count != null && count >= 5) {
      return `${count} different people have already reported this address as a scam on Chainabuse`;
    }
    if (count != null && count > 0) {
      return `someone has already reported this address as a scam on Chainabuse`;
    }
    return "this address has scam reports against it";
  },
  domain_age: (f) => {
    const days = (f.evidence?.domainAgeDays as number | undefined) ?? null;
    const domain = (f.evidence?.domain as string | undefined) ?? "this site";
    return days != null
      ? `${domain} was registered ${ageWord(days)} — brand-new domains almost never run anything legit`
      : `${domain} was just registered, which is a yellow flag on its own`;
  },
  fake_domain_pattern: (f) => {
    const domain = (f.evidence?.domain as string | undefined) ?? "the site";
    return `${domain} is dressed up to look like a real project — squint at the spelling`;
  },
  phishing_message: () =>
    "the message they want you to sign has phrasing straight out of the phishing playbook",
  transfer_above_baseline: (f) => {
    const mult = (f.evidence?.multiple as number | undefined) ?? null;
    return mult != null
      ? `this is around ${mult} times bigger than what you normally send`
      : "this is way bigger than your usual transfer";
  },
  unfamiliar_counterparty: () =>
    "this address isn't anyone you've sent to before",
  unfamiliar_protocol: () =>
    "you've never used this program in your history",
  off_hours_signing: (f) => {
    const hour = (f.evidence?.hourUtc as number | undefined) ?? null;
    return hour != null
      ? `it's ${String(hour).padStart(2, '0')}:00 UTC — way outside your normal active hours, and drainers love off-hours`
      : "you're signing at an unusual hour for you";
  },
};

function lineForFinding(f: RiskFinding): string {
  const builder = RULE_LINES[f.rule];
  if (builder) return builder(f);
  // Unknown rule → just lowercase the existing message and use it.
  return f.message.replace(/\.$/, '').toLowerCase();
}

function joinSentences(parts: string[]): string {
  // Capitalize the first letter of each part, end with period, no double-spaces.
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .join(' ');
}

export function buildVoiceScript(
  findings: RiskFinding[],
  score: number,
  sessionId = 'default',
): string {
  if (findings.length === 0) {
    return "Looks clean to me. You can sign whenever you're ready.";
  }

  const ordered = [...findings].sort((a, b) => b.points - a.points);
  const top = ordered.slice(0, 3);

  const opener = seededPick(
    score >= 80 ? OPENERS_HIGH : score >= 60 ? OPENERS_MED : OPENERS_LOW,
    sessionId,
    'opener',
  );
  const closer = seededPick(
    score >= 80 ? CLOSERS_HIGH : score >= 60 ? CLOSERS_MED : CLOSERS_LOW,
    sessionId,
    'closer',
  );

  const sentences: string[] = [opener];
  top.forEach((f, i) => {
    const body = lineForFinding(f);
    if (i === 0) {
      // Lead finding: weave straight in after the opener.
      sentences.push(`So look — ${body}`);
    } else {
      const conn = seededPick(CONNECTORS, sessionId, `c${i}`);
      sentences.push(`${conn}${body}`);
    }
  });
  sentences.push(closer);

  return joinSentences(sentences);
}

export class TTSVoiceProvider implements VoiceProvider {
  readonly name = 'tts' as const;
  private cache = new Map<string, Buffer>();

  async generate(script: string, sessionId: string): Promise<Buffer> {
    const cached = this.cache.get(sessionId);
    if (cached) return cached;

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.ELEVENLABS_VOICE_ID}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': config.ELEVENLABS_API_KEY,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.45, similarity_boost: 0.7, style: 0.35, use_speaker_boost: true },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ElevenLabs TTS failed: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
    }

    const audio = Buffer.from(await res.arrayBuffer());
    this.cache.set(sessionId, audio);
    return audio;
  }
}

export const voiceProvider: VoiceProvider = new TTSVoiceProvider();
