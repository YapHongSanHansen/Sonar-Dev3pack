import type { RiskFinding, VoiceProvider } from '../types.js';
import { config } from '../config.js';

export function buildVoiceScript(findings: RiskFinding[]): string {
  if (findings.length === 0) {
    return 'This transaction looks safe. You can proceed when ready.';
  }

  const critical = findings.filter((f) => f.level === 'critical');
  const warnings = findings.filter((f) => f.level === 'warning');

  const opener = critical.length > 0
    ? 'Hold on. I need you to take a moment before signing this.'
    : 'Pause for a second. There are a few things you should know.';

  const lines = [...critical, ...warnings, ...findings.filter((f) => f.level === 'info')]
    .slice(0, 3)
    .map((f) => f.message);

  const close = critical.length > 0
    ? 'If anything feels off, cancel now. You can always try again later.'
    : 'Once you have read the details, decide if you still want to proceed.';

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
