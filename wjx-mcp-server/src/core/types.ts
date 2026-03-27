export interface WjxCredentials {
  token: string;
}

export interface WjxApiSuccess<T = unknown> {
  result: true;
  data: T;
}

export interface WjxApiFailure {
  result: false;
  errormsg: string;
  errorcode?: number;
  data?: unknown;
}

export type WjxApiResponse<T = unknown> = WjxApiSuccess<T> | WjxApiFailure;

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface RequestOptions {
  credentials?: WjxCredentials;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxRetries?: number;
}
