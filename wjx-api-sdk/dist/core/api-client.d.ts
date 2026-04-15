import type { WjxCredentials, WjxApiResponse, RequestOptions } from "./types.js";
/**
 * Register a credential provider that will be called before falling back to env vars.
 * Used by MCP Server to inject AsyncLocalStorage-based per-request credentials.
 */
export declare function setCredentialProvider(fn: (() => WjxCredentials | undefined) | undefined): void;
export declare function getWjxCredentials(env?: NodeJS.ProcessEnv): WjxCredentials;
export declare function callWjxApi<T = unknown>(params: Record<string, unknown>, opts?: RequestOptions): Promise<WjxApiResponse<T>>;
export declare function callWjxUserSystemApi<T = unknown>(params: Record<string, unknown>, opts?: RequestOptions): Promise<WjxApiResponse<T>>;
export declare function callWjxSubuserApi<T = unknown>(params: Record<string, unknown>, opts?: RequestOptions): Promise<WjxApiResponse<T>>;
export declare function callWjxContactsApi<T = unknown>(params: Record<string, unknown>, opts?: RequestOptions): Promise<WjxApiResponse<T>>;
export declare function getCorpId(env?: NodeJS.ProcessEnv): string | undefined;
/**
 * Copy defined (non-undefined) keys from source to target.
 * Replaces repetitive `if (input.x !== undefined) params.x = input.x` patterns.
 */
export declare function assignDefined<T extends Record<string, unknown>>(target: T, source: Record<string, unknown> | object, keys: string[]): T;
