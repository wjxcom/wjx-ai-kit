import { Command } from "commander";
import type { WjxApiResponse, FetchLike } from "wjx-api-sdk";
/**
 * Strict integer parser. Rejects garbage like "123abc".
 */
export declare function strictInt(v: string): number;
/**
 * Require a field in the merged input. Throws INPUT_ERROR if missing.
 */
export declare function requireField(merged: Record<string, unknown>, field: string, label?: string): void;
interface ExecuteOpts {
    noAuth?: boolean;
    /** 在输出前转换 API 返回结果（用于提取/重塑数据） */
    transformResult?: (result: WjxApiResponse<unknown>) => unknown;
}
export interface CapturedRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
}
export declare function createCapturingFetch(): {
    fetchImpl: FetchLike;
    getCapturedRequest: () => CapturedRequest | null;
};
export declare function printDryRunPreview(request: CapturedRequest | null): void;
/**
 * Merge stdin data with CLI opts (source-aware).
 * Extracts the common pattern used in both executeCommand and manual handlers.
 */
export declare function getMerged(cmd: Command): Record<string, unknown>;
type SdkFunction = (input: any, creds: any, ...rest: any[]) => Promise<WjxApiResponse<any>>;
/**
 * Central command executor.
 * - Merges stdin data with CLI opts (source-aware)
 * - Gets credentials (unless noAuth)
 * - Calls SDK function
 * - Checks result===false (P0 fix)
 * - Formats output to stdout
 * - Routes errors to stderr JSON with correct exit codes
 */
export declare function executeCommand(program: Command, actionCommand: Command, sdkFn: SdkFunction, buildInput: (merged: Record<string, unknown>) => Record<string, unknown>, opts?: ExecuteOpts): Promise<void>;
export {};
