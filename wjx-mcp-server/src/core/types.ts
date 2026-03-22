export interface WjxCredentials {
  appId: string;
  appKey: string;
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
  timestamp?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export type SignableRecord = Record<string, string | number | boolean | null | undefined>;
