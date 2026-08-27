export type RiskLevel = "read" | "write" | "high-risk-write";

const RISK_ORDER: Record<RiskLevel, number> = {
  read: 0,
  write: 1,
  "high-risk-write": 2,
};

export interface RiskInvocation {
  dryRun?: boolean;
}

export function compareRisk(left: RiskLevel, right: RiskLevel): number {
  return RISK_ORDER[left] - RISK_ORDER[right];
}

export function requiresConfirmation(
  spec: { risk: RiskLevel },
  invocation: RiskInvocation = {},
): boolean {
  return spec.risk === "high-risk-write" && invocation.dryRun !== true;
}
