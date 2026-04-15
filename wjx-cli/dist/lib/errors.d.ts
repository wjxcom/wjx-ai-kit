export type ErrorCode = "API_ERROR" | "INPUT_ERROR" | "AUTH_ERROR";
export declare class CliError extends Error {
    readonly code: ErrorCode;
    readonly exitCode: number;
    constructor(code: ErrorCode, message: string);
}
/**
 * Write structured JSON error to stderr and exit.
 */
export declare function stderrJson(code: ErrorCode, message: string): never;
/**
 * Central error handler. Classifies the error, writes stderr JSON, exits.
 */
export declare function handleError(err: unknown): never;
