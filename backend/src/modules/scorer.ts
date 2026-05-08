import type { RiskFinding, SimResult } from '../types.js';

export function score(sim: SimResult): { score: number; findings: RiskFinding[] } {
  let score = 0;
  const findings: RiskFinding[] = [];

  const solMatch = sim.simulatedTransfer?.match(/^(\d+(?:\.\d+)?) SOL$/);
  if (solMatch && parseFloat(solMatch[1]) > 10) {
    score += 30;
    findings.push({
      level: 'warning',
      message: `Large transfer detected: ${sim.simulatedTransfer}`,
    });
  }

  if (sim.approval === 'unlimited') {
    score += 50;
    findings.push({
      level: 'critical',
      message: 'Unlimited token approval — this program could drain your tokens at any time in the future',
    });
  }

  if (!sim.programVerified) {
    score += 25;
    findings.push({
      level: 'critical',
      message: 'This transaction interacts with an unverified program',
    });
  }

  if (sim.programIds.length > 3) {
    score += 10;
    findings.push({
      level: 'info',
      message: `Complex transaction touching ${sim.programIds.length} programs`,
    });
  }

  if (sim.simulatedTransfer && /\*$/.test(sim.simulatedTransfer)) {
    score += 20;
    findings.push({
      level: 'warning',
      message: 'Token name appears to impersonate a known project',
    });
  }

  return { score: Math.min(score, 100), findings };
}

export function cooldownFor(score: number): number {
  if (score >= 80) return 30;
  if (score >= 60) return 15;
  if (score >= 40) return 5;
  return 0;
}
