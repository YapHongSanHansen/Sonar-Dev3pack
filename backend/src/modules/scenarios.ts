import type { ScenarioKey, SimResult } from '../types.js';

export const SCENARIOS: Record<ScenarioKey, SimResult> = {
  drainer: {
    simulatedTransfer: '50 SOL',
    approval: 'none',
    programVerified: false,
    programIds: ['DrAiNxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxX'],
    rawNote: 'Transfers 50 SOL to an unverified program flagged for drain patterns.',
  },
  unlimited_approval: {
    simulatedTransfer: '0 SOL',
    approval: 'unlimited',
    programVerified: true,
    programIds: ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'],
    rawNote: 'Grants unlimited SPL token approval — the contract can drain tokens at any future time.',
  },
  fake_token: {
    simulatedTransfer: '1000 USDC*',
    approval: 'scoped',
    programVerified: false,
    programIds: ['FaKeT0kEnXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxX'],
    rawNote: 'Receives a token whose name impersonates a major project. Likely a phishing airdrop.',
  },
  safe: {
    simulatedTransfer: '0.001 SOL',
    approval: 'none',
    programVerified: true,
    programIds: ['11111111111111111111111111111111'],
    rawNote: 'Standard SOL transfer to the System Program.',
  },
};

export function pickScenario(key?: ScenarioKey): SimResult {
  return SCENARIOS[key ?? 'safe'];
}
