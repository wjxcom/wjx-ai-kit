import { randomUUID } from "node:crypto";
import { withSignature } from "./sign.js";
import {
  WJX_API_URL,
  WJX_USER_SYSTEM_API_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  RETRY_DELAY_MS,
} from "./constants.js";
import type {
  WjxCredentials,
  WjxApiResponse,
  FetchLike,
  RequestOptions,
  SignableRecord,
} from "./types.js";

export function getUnixTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function generateTraceId(): string {
  return randomUUID().replace(/-/g, "");
}

export function getWjxCredentials(
  env: NodeJS.ProcessEnv = process.env,
): WjxCredentials {
  const appId = env.WJX_APP_ID;
  const appKey = env.WJX_APP_KEY;

  if (!appId || !appKey) {
    throw new Error("WJX_APP_ID and WJX_APP_KEY must be set.");
  }

  return { appId, appKey };
}

export function validateQuestionsJson(questions: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(questions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`questions must be valid JSON: ${message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("questions must be a JSON array");
  }
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _callApi<T = unknown>(
  baseUrl: string,
  params: SignableRecord,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  const credentials = opts.credentials ?? getWjxCredentials();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

  const traceId = generateTraceId();
  const action = String(params.action ?? "unknown");

  // traceid participates in sign but must NOT be in POST body (per WJX spec)
  const signableParams: SignableRecord = {
    ...params,
    appid: credentials.appId,
    ts: opts.timestamp ?? getUnixTimestamp(),
    traceid: traceId,
  };
  const fullSigned = withSignature(signableParams, credentials.appKey);
  const { traceid: _tid, ...signed } = fullSigned as Record<string, unknown>;
  const url = `${baseUrl}?traceid=${traceId}&action=${encodeURIComponent(action)}`;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
      console.error(
        `[wjx] retry ${attempt}/${maxRetries} for action=${action} traceid=${traceId} after ${delay}ms`,
      );
      await sleep(delay);
      // Refresh timestamp on retry since WJX has a 30s window
      signableParams.ts = getUnixTimestamp();
      const freshFull = withSignature(signableParams, credentials.appKey) as Record<string, unknown>;
      signed.ts = freshFull.ts;
      signed.sign = freshFull.sign;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(signed),
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

      const result = (await response.json()) as WjxApiResponse<T>;

      if (result.result === false) {
        console.error(
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
        error instanceof TypeError && error.message !== undefined;
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
  params: SignableRecord,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  return _callApi<T>(WJX_API_URL, params, opts);
}

export async function callWjxUserSystemApi<T = unknown>(
  params: SignableRecord,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  return _callApi<T>(WJX_USER_SYSTEM_API_URL, params, opts);
}
