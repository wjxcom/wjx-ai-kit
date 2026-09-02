export interface WjxCredentials {
    apiKey: string;
    clientIp?: string;
    /** Optional per-request deployment base URL (for multi-tenant callers). */
    baseUrl?: string;
    /** Optional enterprise id carried by profile-aware callers. */
    corpId?: string;
}
export interface WjxApiSuccess<T = unknown> {
    result: true;
    data: T;
    traceid?: string;
}
export interface WjxApiFailure {
    result: false;
    errormsg: string;
    errorcode?: number | string;
    data?: unknown;
    traceid?: string;
}
export type WjxApiResponse<T = unknown> = WjxApiSuccess<T> | WjxApiFailure;
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export interface Logger {
    warn(msg: string): void;
    error(msg: string): void;
}
export interface RequestOptions {
    credentials?: WjxCredentials;
    fetchImpl?: FetchLike;
    /** Per-request deployment base URL; overrides environment routing. */
    baseUrl?: string;
    timeoutMs?: number;
    maxRetries?: number;
    /** Optional caller budget; defaults preserve the existing maxRetries behavior. */
    retryBudget?: number;
    /** Optional client identity sent as X-WJX-Client headers for server-side compatibility checks. */
    clientName?: string;
    clientVersion?: string;
    traceId?: string;
    logger?: Logger;
}
/** Per-call transport overrides for module convenience functions. */
export type RequestOverrides = Omit<RequestOptions, "credentials" | "fetchImpl">;
