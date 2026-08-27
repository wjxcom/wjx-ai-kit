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

export function success<T>(data: T, meta?: Record<string, unknown>): ResultEnvelope<T> {
  return meta && Object.keys(meta).length > 0 ? { ok: true, data, meta } : { ok: true, data };
}

export function problem(error: ProblemEnvelope["error"]): ProblemEnvelope {
  return { ok: false, error };
}
