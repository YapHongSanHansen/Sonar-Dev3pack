import type { InterceptorPayload, RiskContext, SimResult } from '../types.js';
import { pickScenario } from './scenarios.js';
import { getWalletAgeDays, hasPriorInteraction } from './sources/helius.js';
import { getScamReportCount } from './sources/chainabuse.js';
import { getDomainAgeDays, extractDomain } from './sources/whois.js';
import { analyzeDomain } from './sources/domainPatterns.js';

const emptySim: SimResult = {
  simulatedTransfer: null,
  approval: 'none',
  programVerified: true,
  programIds: [],
  rawNote: 'No transaction details decoded.',
};

export async function gather(
  payload: InterceptorPayload,
): Promise<{ sim: SimResult; ctx: RiskContext }> {
  if (payload.scenario) {
    return pickScenario(payload.scenario);
  }

  const counterparty = payload.counterparty ?? null;
  const domain = payload.domain ? extractDomain(payload.domain) : null;

  const [walletAgeDays, prior, scamReportCount, domainAgeDays] = await Promise.all([
    counterparty ? getWalletAgeDays(counterparty) : Promise.resolve(null),
    counterparty ? hasPriorInteraction(payload.wallet, counterparty) : Promise.resolve(null),
    counterparty ? getScamReportCount(counterparty) : Promise.resolve(null),
    domain ? getDomainAgeDays(domain) : Promise.resolve(null),
  ]);

  const ctx: RiskContext = {
    domain,
    counterparty,
    walletAgeDays,
    hasPriorInteraction: prior,
    scamReportCount,
    domainAgeDays,
    domainSuspicionReasons: domain ? analyzeDomain(domain) : [],
  };

  return { sim: emptySim, ctx };
}

export const simulate = gather;
