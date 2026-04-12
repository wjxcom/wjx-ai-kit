import { randomUUID } from "node:crypto";
import {
  getWjxApiUrl,
  getWjxUserSystemApiUrl,
  getWjxSubuserApiUrl,
  getWjxContactsApiUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  RETRY_DELAY_MS,
} from "./constants.js";
import type {
  WjxCredentials,
  WjxApiResponse,
  FetchLike,
  Logger,
  RequestOptions,
} from "./types.js";

/** Pluggable credential provider for per-request credentials (e.g. multi-tenant). */
let _credentialProvider: (() => WjxCredentials | undefined) | undefined;

/**
 * Register a credential provider that will be called before falling back to env vars.
 * Used by MCP Server to inject AsyncLocalStorage-based per-request credentials.
 */
export function setCredentialProvider(
  fn: (() => WjxCredentials | undefined) | undefined,
): void {
  _credentialProvider = fn;
}

function generateTraceId(): string {
  return randomUUID().replace(/-/g, "");
}

export function getWjxCredentials(
  env: NodeJS.ProcessEnv = process.env,
): WjxCredentials {
  // 1. Per-request credentials from registered provider (e.g. AsyncLocalStorage)
  const providerCreds = _credentialProvider?.();
  if (providerCreds) return providerCreds;

  // 2. Fallback: environment variables (single-tenant / stdio / CLI mode)
  const apiKey = env.WJX_API_KEY;

  if (!apiKey) {
    throw new Error(
      "WJX_API_KEY must be set (via env var or credential provider).",
    );
  }

  return { apiKey };
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _callApi<T = unknown>(
  baseUrl: string,
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  const credentials = opts.credentials ?? getWjxCredentials();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const logger = opts.logger;

  const traceId = generateTraceId();
  const action = String(params.action ?? "unknown");

  const url = `${baseUrl}?traceid=${traceId}&action=${encodeURIComponent(action)}`;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
      logger?.warn(
        `[wjx] retry ${attempt}/${maxRetries} for action=${action} traceid=${traceId} after ${delay}ms`,
      );
      await sleep(delay);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Bearer ${credentials.apiKey}`,
        };
        if (credentials.clientIp) {
          headers["X-Forwarded-For"] = credentials.clientIp;
        }

        response = await fetchImpl(url, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        if (isRetryable(response.status) && attempt < maxRetries) {
          lastError = new Error(
            `WJX API request failed with ${response.status} ${response.statusText}`,
          );
          continue;
        }
        throw new Error(
          `WJX API request failed with ${response.status} ${response.statusText}`,
        );
      }

      let result: WjxApiResponse<T>;
      try {
        result = (await response.json()) as WjxApiResponse<T>;
      } catch (parseError) {
        throw new Error(
          `WJX API returned unparseable response for action=${action} traceid=${traceId}: ${
            parseError instanceof Error ? parseError.message : String(parseError)
          }`,
        );
      }

      if (result.result === false) {
        logger?.error(
          `[wjx] api error action=${action} traceid=${traceId}: ${result.errormsg}`,
        );
      }

      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new Error(
          `WJX API request timed out after ${timeoutMs}ms (action=${action}, traceid=${traceId})`,
        );
        if (attempt < maxRetries) continue;
        throw lastError;
      }

      const isNetworkError =
        error instanceof TypeError &&
        typeof error.message === "string" &&
        /fetch|network|connect|ECONNR|ETIMEDOUT|EAI_AGAIN/i.test(error.message);
      if (isNetworkError && attempt < maxRetries) {
        lastError = error as Error;
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("Exhausted retries");
}

export async function callWjxApi<T = unknown>(
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  return _callApi<T>(getWjxApiUrl(), params, opts);
}

export async function callWjxUserSystemApi<T = unknown>(
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  return _callApi<T>(getWjxUserSystemApiUrl(), params, opts);
}

export async function callWjxSubuserApi<T = unknown>(
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  return _callApi<T>(getWjxSubuserApiUrl(), params, opts);
}

export async function callWjxContactsApi<T = unknown>(
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  return _callApi<T>(getWjxContactsApiUrl(), params, opts);
}

export function getCorpId(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.WJX_CORP_ID || undefined;
}

/**
 * Copy defined (non-undefined) keys from source to target.
 * Replaces repetitive `if (input.x !== undefined) params.x = input.x` patterns.
 */
export function assignDefined<T extends Record<string, unknown>>(
  target: T, source: Record<string, unknown> | object, keys: string[],
): T {
  const src = source as Record<string, unknown>;
  for (const k of keys) {
    if (src[k] !== undefined) (target as Record<string, unknown>)[k] = src[k];
  }
  return target;
}
