export type InterceptorPayload = {
  wallet: string;
  transaction: string;
  type: 'signTransaction' | 'signMessage';
  scenario?: ScenarioKey;
};

export type ScenarioKey = 'drainer' | 'unlimited_approval' | 'fake_token' | 'safe';

export type SimResult = {
  simulatedTransfer: string | null;
  approval: 'unlimited' | 'scoped' | 'none';
  programVerified: boolean;
  programIds: string[];
  rawNote: string;
};

export type RiskLevel = 'critical' | 'warning' | 'info';

export type RiskFinding = {
  level: RiskLevel;
  message: string;
};

export type RiskVerdict = {
  riskRequired: boolean;
  score: number;
  cooldownSeconds: number;
  sim: SimResult;
  findings: RiskFinding[];
  voiceScript: string;
  sessionId: string;
};

export interface VoiceProvider {
  readonly name: 'tts' | 'conversational';
  generate(script: string, sessionId: string): Promise<Buffer>;
}

export type CooldownEntry = {
  wallet: string;
  sessionId: string;
  expiresAt: number;
  verdict: RiskVerdict;
};
