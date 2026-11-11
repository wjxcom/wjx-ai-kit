export type RiskLevel = "read" | "write" | "high-risk-write";
export interface RiskInvocation {
    dryRun?: boolean;
}
export declare function compareRisk(left: RiskLevel, right: RiskLevel): number;
export declare function requiresConfirmation(spec: {
    risk: RiskLevel;
}, invocation?: RiskInvocation): boolean;
