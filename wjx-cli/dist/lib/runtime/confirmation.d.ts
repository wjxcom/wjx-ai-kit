import type { Readable, Writable } from "node:stream";
import { CliError } from "../errors.js";
import type { CommandMetadata } from "../command-metadata.js";
import type { PolicyEvaluator } from "../policy.js";
export type ConfirmationSource = "cli_yes" | "interactive" | "policy" | "missing" | "not_required";
export interface ConfirmationOptions {
    yes?: boolean;
    nonInteractive?: boolean;
    dryRun?: boolean;
}
export interface ConfirmationRequest {
    command: string;
    metadata: CommandMetadata;
    input: Record<string, unknown>;
    options: ConfirmationOptions;
    policy?: PolicyEvaluator;
    inputStream?: Readable;
    outputStream?: Writable;
}
export declare class ConfirmationRequiredError extends CliError {
    constructor(request: ConfirmationRequest, target: string);
}
export declare function summarizeTarget(input: Record<string, unknown>, fields: string[]): string;
export declare function ensureConfirmation(request: ConfirmationRequest): Promise<ConfirmationSource>;
