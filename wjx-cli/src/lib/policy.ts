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

/** Task 3 intentionally has no remote permission policy; callers may inject one later. */
export const defaultPolicyEvaluator: PolicyEvaluator = {
  evaluate: () => ({ allowed: true, source: "default" }),
};

export const allowAllPolicy = defaultPolicyEvaluator;
