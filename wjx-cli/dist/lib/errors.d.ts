import type { WjxApiResponse } from "wjx-api-sdk";
export type ErrorCode = "API_ERROR" | "INPUT_ERROR" | "AUTH_ERROR" | "CONFIRMATION_REQUIRED" | "POLICY_DENIED" | "UPGRADE_REQUIRED";
export type ErrorDetails = Record<string, unknown>;
export declare class CliError extends Error {
    readonly code: ErrorCode;
    readonly exitCode: number;
    readonly details?: ErrorDetails;
    constructor(code: ErrorCode, message: string, details?: ErrorDetails);
}
/** Internal control-flow marker: an error envelope has already been emitted. */
export declare class CliErrorHandled extends Error {
    constructor();
}
export declare function isCliErrorHandled(err: unknown): err is CliErrorHandled;
/**
 * Write structured JSON error to stderr and terminate the current command path.
 */
export declare function stderrJson(code: ErrorCode, message: string, details?: ErrorDetails): never;
/**
 * Central error handler. Classifies the error and writes one stderr envelope.
 */
export declare function handleError(err: unknown): never;
/** Convert a WJX response failure without dropping upstream diagnostics. */
export declare function ensureApiSuccess<T>(response: WjxApiResponse<T>): asserts response is Extract<WjxApiResponse<T>, {
    result: true;
}>;
