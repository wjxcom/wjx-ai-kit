import { randomUUID } from "node:crypto";
import {
  WJX_API_URL,
  WJX_USER_SYSTEM_API_URL,
  WJX_SUBUSER_API_URL,
  WJX_CONTACTS_API_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  RETRY_DELAY_MS,
} from "./constants.js";
import { getRequestCredentials } from "./context.js";
import type {
  WjxCredentials,
  WjxApiResponse,
  FetchLike,
  RequestOptions,
} from "./types.js";

function generateTraceId(): string {
  return randomUUID().replace(/-/g, "");
}

export function getWjxCredentials(
  env: NodeJS.ProcessEnv = process.env,
): WjxCredentials {
  // 1. Per-request credentials injected by HTTP transport (multi-tenant)
  const reqCreds = getRequestCredentials();
  if (reqCreds) return reqCreds;

  // 2. Fallback: environment variables (single-tenant / stdio mode)
  const token = env.WJX_TOKEN;

  if (!token) {
    throw new Error(
      "WJX_TOKEN must be set (via env var or Authorization header).",
    );
  }

  return { token };
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
  for (const [i, q] of (parsed as Record<string, unknown>[]).entries()) {
    if (typeof q.q_index !== "number") {
      throw new Error(`questions[${i}] missing required field "q_index" (number)`);
    }
    if (typeof q.q_type !== "number") {
      throw new Error(`questions[${i}] missing required field "q_type" (number)`);
    }
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
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  const credentials = opts.credentials ?? getWjxCredentials();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

  const traceId = generateTraceId();
  const action = String(params.action ?? "unknown");

  const url = `${baseUrl}?traceid=${traceId}&action=${encodeURIComponent(action)}`;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
      console.error(
        `[wjx] retry ${attempt}/${maxRetries} for action=${action} traceid=${traceId} after ${delay}ms`,
      );
      await sleep(delay);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${credentials.token}`,
          },
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
  return _callApi<T>(WJX_API_URL, params, opts);
}

export async function callWjxUserSystemApi<T = unknown>(
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  return _callApi<T>(WJX_USER_SYSTEM_API_URL, params, opts);
}

export async function callWjxSubuserApi<T = unknown>(
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  return _callApi<T>(WJX_SUBUSER_API_URL, params, opts);
}

export async function callWjxContactsApi<T = unknown>(
  params: Record<string, unknown>,
  opts: RequestOptions = {},
): Promise<WjxApiResponse<T>> {
  return _callApi<T>(WJX_CONTACTS_API_URL, params, opts);
}

export function getCorpId(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.WJX_CORP_ID || undefined;
}
