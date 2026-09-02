import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
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

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as { version?: unknown };
const SDK_CLIENT_NAME = "wjx-api-sdk";
const SDK_CLIENT_VERSION = typeof packageJson.version === "string" && packageJson.version.trim()
  ? packageJson.version.trim()
  : "0.4.1";

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
  if (providerCreds) return normalizeCredentials(providerCreds);

  // 2. Fallback: environment variables (single-tenant / stdio / CLI mode)
  const apiKey = typeof env.WJX_API_KEY === "string" ? env.WJX_API_KEY.trim() : "";

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

const MAX_RETRY_BUDGET = 10_000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const MAX_RETRY_DELAY_MS = 30_000;

function normalizeCredentials(credentials: WjxCredentials): WjxCredentials {
  const apiKey = typeof credentials?.apiKey === "string" ? credentials.apiKey.trim() : "";
  if (!apiKey) {
    throw new Error(
      "WJX_API_KEY must be set (via env var, credential provider, or explicit credentials).",
    );
  }
  const baseUrl = typeof credentials.baseUrl === "string" && credentials.baseUrl.trim()
    ? credentials.baseUrl.trim()
    : undefined;
  const corpId = typeof credentials.corpId === "string" && credentials.corpId.trim()
    ? credentials.corpId.trim()
    : undefined;
  const clientIp = typeof credentials.clientIp === "string" && credentials.clientIp.trim()
    ? credentials.clientIp.trim()
    : undefined;
  return {
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    ...(corpId ? { corpId } : {}),
    ...(clientIp ? { clientIp } : {}),
  };
}

function resolveBaseUrl(explicit: string | undefined, credentialBaseUrl: string | undefined): string | undefined {
  const requested = typeof explicit === "string" && explicit.trim() ? explicit.trim() : undefined;
  if (requested) return requested;
  return typeof credentialBaseUrl === "string" && credentialBaseUrl.trim()
    ? credentialBaseUrl.trim()
    : undefined;
}

function normalizeRetryBudget(opts: RequestOptions): number {
  const value = opts.retryBudget ?? opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_RETRY_BUDGET) {
    const name = opts.retryBudget !== undefined ? "retryBudget" : "maxRetries";
    throw new TypeError(`${name} must be a finite safe integer between 0 and ${MAX_RETRY_BUDGET}`);
  }
  return value;
}

function normalizeTimeoutMs(value: number | undefined): number {
  const timeoutMs = value ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new TypeError(`timeoutMs must be a finite positive safe integer between 1 and ${MAX_TIMEOUT_MS}`);
  }
  return timeoutMs;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _callApi<T = unknown>(
  baseUrl: string,
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  const credentials = normalizeCredentials(opts.credentials ?? getWjxCredentials());
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = normalizeTimeoutMs(opts.timeoutMs);
  const maxRetries = normalizeRetryBudget(opts);
  const logger = opts.logger;

  const traceId = opts.traceId ?? generateTraceId();
  const action = String(params.action ?? "unknown");

  const url = `${baseUrl}?traceid=${traceId}&action=${encodeURIComponent(action)}`;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(
        MAX_RETRY_DELAY_MS,
        RETRY_DELAY_MS * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5),
      );
      logger?.warn(
        `[wjx] retry ${attempt}/${maxRetries} for action=${action} traceid=${traceId} after ${delay}ms`,
      );
      await sleep(delay);
    }

    try {
      const controller = new AbortController();
      let rejectTimeout!: (reason: unknown) => void;
      const timeoutError = new DOMException("The operation timed out", "AbortError");
      const timeoutPromise = new Promise<never>((_, reject) => {
        rejectTimeout = reject;
      });
      const timer = setTimeout(() => {
        controller.abort();
        rejectTimeout(timeoutError);
      }, timeoutMs);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credentials.apiKey}`,
        };
        const clientName = opts.clientName === undefined
          ? SDK_CLIENT_NAME
          : typeof opts.clientName === "string" ? opts.clientName.trim() : "";
        const clientVersion = opts.clientVersion === undefined
          ? SDK_CLIENT_VERSION
          : typeof opts.clientVersion === "string" ? opts.clientVersion.trim() : "";
        if (clientName) {
          headers["X-WJX-Client"] = clientName;
        }
        if (clientVersion) {
          headers["X-WJX-Client-Version"] = clientVersion;
        }
        if (credentials.clientIp) {
          headers["X-Forwarded-For"] = credentials.clientIp;
        }

        const response = await Promise.race([
          fetchImpl(url, {
            method: "POST",
            headers,
            body: JSON.stringify(params),
            signal: controller.signal,
          }),
          timeoutPromise,
        ]);

        if (!response.ok) {
          // Release a non-2xx body before retrying or throwing. Undici cannot
          // reuse the connection while the response stream remains open.
          try {
            await Promise.race([response.body?.cancel() ?? Promise.resolve(), timeoutPromise]);
          } catch (error) {
            if (error === timeoutError) throw error;
            // Preserve the original HTTP status error if body cleanup fails.
          }
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
          result = await Promise.race([response.json(), timeoutPromise]) as WjxApiResponse<T>;
        } catch (parseError) {
          if (isAbortError(parseError)) throw parseError;
          throw new Error(
            `WJX API returned unparseable response for action=${action} traceid=${traceId}: ${
              parseError instanceof Error ? parseError.message : String(parseError)
            }`,
          );
        }

        if (!result || typeof result !== "object" || Array.isArray(result)) {
          throw new Error(
            `WJX API returned an invalid response for action=${action} traceid=${traceId}: expected an object`,
          );
        }

        if (typeof result.result !== "boolean") {
          throw new Error(
            `WJX API returned an invalid response for action=${action} traceid=${traceId}: result must be a boolean`,
          );
        }

        if (result.result === false) {
          logger?.error(
            `[wjx] api error action=${action} traceid=${traceId}: ${result.errormsg}`,
          );
        }

        return result;
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      if (isAbortError(error)) {
        lastError = new Error(
          `WJX API request timed out after ${timeoutMs}ms (action=${action}, traceid=${traceId})`,
        );
        if (attempt < maxRetries) continue;
        throw lastError;
      }

      const errorCode = error instanceof Error
        ? (error as Error & { code?: unknown }).code
        : undefined;
      const errorText = [
        error instanceof Error ? error.message : String(error),
        typeof errorCode === "string" ? errorCode : "",
      ].join(" ");
      const isNetworkError = /fetch|network|connect|ECONN|ETIMEDOUT|EAI_AGAIN/i.test(errorText);
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
  const credentials = normalizeCredentials(opts.credentials ?? getWjxCredentials());
  return _callApi<T>(getWjxApiUrl(resolveBaseUrl(opts.baseUrl, credentials.baseUrl)), params, { ...opts, credentials });
}

export async function callWjxUserSystemApi<T = unknown>(
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  const credentials = normalizeCredentials(opts.credentials ?? getWjxCredentials());
  return _callApi<T>(getWjxUserSystemApiUrl(resolveBaseUrl(opts.baseUrl, credentials.baseUrl)), params, { ...opts, credentials });
}

export async function callWjxSubuserApi<T = unknown>(
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  const credentials = normalizeCredentials(opts.credentials ?? getWjxCredentials());
  return _callApi<T>(getWjxSubuserApiUrl(resolveBaseUrl(opts.baseUrl, credentials.baseUrl)), params, { ...opts, credentials });
}

export async function callWjxContactsApi<T = unknown>(
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  const credentials = normalizeCredentials(opts.credentials ?? getWjxCredentials());
  return _callApi<T>(getWjxContactsApiUrl(resolveBaseUrl(opts.baseUrl, credentials.baseUrl)), params, { ...opts, credentials });
}

export function getCorpId(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const corpId = env.WJX_CORP_ID?.trim();
  return corpId || undefined;
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
