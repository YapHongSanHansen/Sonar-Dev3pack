import type { InterceptorPayload, SimResult } from '../types.js';
import { pickScenario } from './scenarios.js';

export async function simulate(payload: InterceptorPayload): Promise<SimResult> {
  // MVP: scenario-driven mock. Scenario picked from payload (demo dApp sends it).
  // Future: decode payload.transaction with @solana/web3.js, call Helius
  // simulateTransaction with parsed-instructions enabled, map result to SimResult.
  return pickScenario(payload.scenario);
}
