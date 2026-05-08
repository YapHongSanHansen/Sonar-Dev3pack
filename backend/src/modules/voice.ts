import type { RiskFinding, VoiceProvider } from '../types.js';
import { config } from '../config.js';

export function buildVoiceScript(findings: RiskFinding[], score: number): string {
  if (findings.length === 0) {
    return 'This transaction looks safe. You can proceed when ready.';
  }

  const critical = findings.filter((f) => f.level === 'critical');
  const warnings = findings.filter((f) => f.level === 'warning');

  const opener = score >= 80
    ? 'Stop. Do not sign this. I need you to listen carefully.'
    : score >= 60
      ? 'Hold on. Before you sign, I need you to know what this transaction actually does.'
      : 'Pause for a moment. There are a couple of things worth checking.';

  const ordered = [...critical, ...warnings, ...findings.filter((f) => f.level === 'info')].slice(0, 3);
  const lines: string[] = [];
  for (const f of ordered) {
    lines.push(f.message);
    const solMatch = f.message.match(/(\d+(?:\.\d+)?)\s*SOL\b/i);
    if (solMatch) {
      lines.push(`That's ${solMatch[1]} SOL — a significant amount that you cannot recover if this is a scam.`);
    }
  }

  const close = score >= 80
    ? "If you have any doubt at all, cancel now. There's almost no transaction worth this risk."
    : score >= 60
      ? "If anything feels off, cancel and verify with the project's official channels first."
      : 'Take a breath. If it still looks right after reading the details, you can proceed.';

  return [opener, ...lines, close].join(' ');
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
        voice_settings: { stability: 0.55, similarity_boost: 0.75 },
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
