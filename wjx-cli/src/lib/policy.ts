import type { CommandMetadata } from "./command-metadata.js";

export interface PolicyInvocation {
  command: string;
  input: Record<string, unknown>;
  options: Record<string, unknown>;
}

export interface PolicyDecision {
  allowed: boolean;
  source?: string;
  reason?: string;
}

export interface PolicyEvaluator {
  evaluate(metadata: CommandMetadata, invocation: PolicyInvocation): PolicyDecision | Promise<PolicyDecision>;
}

export interface StaticPolicyRule {
  command?: string;
  maxRisk?: "read" | "write" | "high-risk-write";
  identities?: Array<"user" | "bot" | "unknown">;
  allowUnmarked?: boolean;
}

function glob(pattern: string, value: string): boolean {
  return new RegExp(`^${pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`).test(value);
}

export function createStaticPolicy(rules: StaticPolicyRule[]): PolicyEvaluator {
  return { evaluate: (metadata, invocation) => {
    const matches = rules.filter((rule) => !rule.command || glob(rule.command, invocation.command));
    for (const rule of matches) {
      if (rule.maxRisk && ["read", "write", "high-risk-write"].indexOf(metadata.risk) > ["read", "write", "high-risk-write"].indexOf(rule.maxRisk)) return { allowed: false, source: "static", reason: `risk exceeds ${rule.maxRisk}` };
      if (rule.identities && !rule.identities.some((identity) => metadata.identities.includes(identity))) return { allowed: false, source: "static", reason: "identity not allowed" };
      if (rule.allowUnmarked === false && metadata.identities.includes("unknown")) return { allowed: false, source: "static", reason: "unmarked command denied" };
    }
    return { allowed: true, source: "static" };
  } };
}

/** Task 3 intentionally has no remote permission policy; callers may inject one later. */
export const defaultPolicyEvaluator: PolicyEvaluator = {
  evaluate: () => ({ allowed: true, source: "default" }),
};

export const allowAllPolicy = defaultPolicyEvaluator;
