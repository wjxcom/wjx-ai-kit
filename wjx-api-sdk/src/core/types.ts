export interface WjxCredentials {
  apiKey: string;
  clientIp?: string;
}

export interface WjxApiSuccess<T = unknown> {
  result: true;
  data: T;
}

export interface WjxApiFailure<TData = unknown> {
  result: false;
  errormsg: string;
  errorcode?: number;
  data?: TData;
}

export type WjxApiResponse<T = unknown, TFailureData = unknown> =
  | WjxApiSuccess<T>
  | WjxApiFailure<TFailureData>;

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface Logger {
  warn(msg: string): void;
  error(msg: string): void;
}

export interface RequestOptions {
  credentials?: WjxCredentials;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxRetries?: number;
  logger?: Logger;
  /** Dedicated optimistic-concurrency header; arbitrary headers are intentionally unsupported. */
  ifMatch?: string;
}
