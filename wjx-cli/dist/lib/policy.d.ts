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
export declare function createStaticPolicy(rules: StaticPolicyRule[]): PolicyEvaluator;
/** Task 3 intentionally has no remote permission policy; callers may inject one later. */
export declare const defaultPolicyEvaluator: PolicyEvaluator;
export declare const allowAllPolicy: PolicyEvaluator;
