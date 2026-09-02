import type { WjxApiResponse } from "wjx-api-sdk";
export type ErrorCode = "API_ERROR" | "INPUT_ERROR" | "AUTH_ERROR" | "CONFIRMATION_REQUIRED" | "POLICY_DENIED" | "UPGRADE_REQUIRED";
export type ErrorDetails = Record<string, unknown>;
export declare class CliError extends Error {
    readonly code: ErrorCode;
    readonly exitCode: number;
    readonly details?: ErrorDetails;
    constructor(code: ErrorCode, message: string, details?: ErrorDetails);
}
/**
 * Write structured JSON error to stderr and exit.
 */
export declare function stderrJson(code: ErrorCode, message: string, details?: ErrorDetails): void;
/**
 * Central error handler. Classifies the error, writes stderr JSON, exits.
 */
export declare function handleError(err: unknown): void;
/** Convert a WJX response failure without dropping upstream diagnostics. */
export declare function ensureApiSuccess<T>(response: WjxApiResponse<T>): asserts response is Extract<WjxApiResponse<T>, {
    result: true;
}>;
