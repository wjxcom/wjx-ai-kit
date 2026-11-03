import type { Command } from "commander";
import type { RiskLevel } from "./runtime/risk.js";
export interface CommandMetadata {
    path: string;
    risk: RiskLevel;
    identities: Array<"user" | "bot" | "unknown">;
    targetFields: string[];
    /** Agent-facing execution facts are derived here so generated contracts have one source. */
    httpRetryable?: boolean;
    /** Whether the endpoint is safe to replay after a transport failure. */
    idempotent?: boolean;
    consumesQueue?: boolean;
    preRead?: boolean;
    postVerify?: boolean;
    ambiguousTimeout?: "stop-and-report" | "read-after-write";
    maxBatch?: number | null;
}
export declare const COMMAND_METADATA: Readonly<Record<string, CommandMetadata>>;
export interface AgentExecutionFacts {
    httpRetryable: boolean;
    idempotent: boolean;
    consumesQueue: boolean;
    preRead: boolean;
    postVerify: boolean;
    ambiguousTimeout: "stop-and-report" | "read-after-write";
    maxBatch: number | null;
}
/** Derive Agent facts from command ownership and existing risk annotations. */
export declare function getAgentExecutionFacts(entry: CommandMetadata): AgentExecutionFacts;
export declare function getCommandMetadata(path: string): CommandMetadata;
export declare function listHighRiskCommands(): string[];
export declare function getCommandPath(command: Command): string;
