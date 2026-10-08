export interface ResultEnvelope<T = unknown> {
    ok: true;
    data: T;
    meta?: Record<string, unknown>;
}
export interface ProblemEnvelope {
    ok: false;
    error: {
        type: string;
        subtype?: string;
        code?: string | number;
        message: string;
        hint?: string;
        retryable?: boolean;
        retry_after?: number;
        trace_id?: string;
    };
}
export declare function success<T>(data: T, meta?: Record<string, unknown>): ResultEnvelope<T>;
export declare function problem(error: ProblemEnvelope["error"]): ProblemEnvelope;
