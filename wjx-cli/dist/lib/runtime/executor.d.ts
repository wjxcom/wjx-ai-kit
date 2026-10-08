import type { Command } from "commander";
import { type WjxCredentials, type WjxApiResponse, type RequestOverrides } from "wjx-api-sdk";
import type { RequestPlan } from "./types.js";
import { type RuntimeContext } from "./context.js";
interface RuntimeCommandSpec {
    /** Command does not require an API key (for example public URL helpers). */
    noAuth?: boolean;
    normalize?: (context: {
        values: Record<string, unknown>;
        source: Record<string, string>;
    }) => Record<string, unknown>;
    validate?: (input: Record<string, unknown>) => void;
    /** Pure request projection. It must not require credentials or a transport. */
    buildPlans: (input: Record<string, unknown>, context?: {
        apiUrl?: string;
    }) => RequestPlan[];
    /** Read the current state before a write. Never called during dry-run. */
    preRead?: (input: Record<string, unknown>, credentials: WjxCredentials, requestOptions?: RequestOverrides) => Promise<unknown>;
    /** Execution-only input preparation. It may perform network prefetches. */
    prepareExecute?: (input: Record<string, unknown>, credentials: WjxCredentials, requestOptions?: RequestOverrides, preReadResult?: unknown) => Promise<Record<string, unknown>>;
    execute: (input: Record<string, unknown>, credentials: WjxCredentials, requestOptions?: RequestOverrides) => Promise<WjxApiResponse<unknown>>;
    /** Optional protocol validator for endpoints that do not use result=true/false. */
    validateResult?: (result: unknown) => void;
    transformResult?: (result: WjxApiResponse<unknown>) => unknown;
    /** Verification fields that must be true before reporting a write as successful. */
    requiredVerification?: readonly ("structure" | "status" | "link")[];
    /** Read-after-write verification appended to the successful result. */
    postVerify?: (result: WjxApiResponse<unknown>, input: Record<string, unknown>, credentials: WjxCredentials, preReadResult?: unknown) => Promise<unknown>;
    context?: RuntimeContext;
}
interface RuntimeActionOptions {
    noAuth?: boolean;
    /** Print only after a successful real execution; never pollutes errors or dry-run output. */
    deprecationWarning?: string;
    /** Add pure local information to a dry-run result without making network requests. */
    dryRunPreview?: (input: Record<string, unknown>) => Record<string, unknown> | undefined;
    /** Transform the successful API response before formatting. */
    transformResult?: (result: WjxApiResponse<unknown>) => unknown;
    /** Skip even the captured transport preview for commands whose dry-run is informational only. */
    dryRunNoRequest?: boolean;
    /** Read the current state before a write. Never called during dry-run. */
    preRead?: (input: Record<string, unknown>, creds: WjxCredentials, requestOptions?: RequestOverrides) => Promise<unknown>;
    /** Execution-only input preparation. It may perform network prefetches. */
    transformInput?: (input: Record<string, unknown>, creds: WjxCredentials, requestOptions?: RequestOverrides, preReadResult?: unknown) => Promise<Record<string, unknown>>;
    /** Optional runtime dependencies for tests and embedded callers. */
    context?: RuntimeContext;
    /** Transport metadata for SDK calls made by this command. */
    requestOptions?: RequestOverrides;
    /** Verification fields that must be true before reporting a write as successful. */
    requiredVerification?: readonly ("structure" | "status" | "link")[];
    /** Read-after-write verification appended to the successful result. */
    postVerify?: (result: WjxApiResponse<unknown>, input: Record<string, unknown>, credentials: WjxCredentials, preReadResult?: unknown) => Promise<unknown>;
}
type RuntimeSdkFunction = (input: any, creds: any, ...rest: any[]) => Promise<WjxApiResponse<any>>;
/** Internal facade used by migrated commands; it has no public protocol of its own. */
export declare function executeRuntimeCommand(program: Command, actionCommand: Command, spec: RuntimeCommandSpec): Promise<void>;
/**
 * Execute a legacy-shaped action through the shared runtime lifecycle.
 *
 * This is deliberately kept in the runtime module rather than command helpers:
 * command registration code only supplies input binding and the SDK action,
 * while auth, dry-run, confirmation, transport and output remain centralized.
 */
export declare function executeRuntimeAction(program: Command, actionCommand: Command, sdkFn: RuntimeSdkFunction, buildInput: (merged: Record<string, unknown>) => Record<string, unknown>, options?: RuntimeActionOptions): Promise<void>;
/** Run a pure/local command through the same output and error boundary. */
export declare function executeRuntimeLocal(program: Command, actionCommand: Command, run: (input: Record<string, unknown>, command: Command) => unknown | Promise<unknown>, options?: {
    rawOutput?: boolean;
    dryRun?: (input: Record<string, unknown>) => Record<string, unknown> | undefined;
    emit?: (result: unknown, input: Record<string, unknown>) => boolean;
    exitCode?: (result: unknown) => number | undefined;
}): Promise<void>;
export {};
