import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { getWjxApiUrl, getWjxUserSystemApiUrl, getWjxSubuserApiUrl, getWjxContactsApiUrl, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_RETRIES, RETRY_DELAY_MS, } from "./constants.js";
const require = createRequire(import.meta.url);
const packageJson = require("../../package.json");
const SDK_CLIENT_NAME = "wjx-api-sdk";
const SDK_CLIENT_VERSION = typeof packageJson.version === "string" && packageJson.version.trim()
    ? packageJson.version.trim()
    : "0.4.1";
/** Pluggable credential provider for per-request credentials (e.g. multi-tenant). */
let _credentialProvider;
/**
 * Register a credential provider that will be called before falling back to env vars.
 * Used by MCP Server to inject AsyncLocalStorage-based per-request credentials.
 */
export function setCredentialProvider(fn) {
    _credentialProvider = fn;
}
function generateTraceId() {
    return randomUUID().replace(/-/g, "");
}
export function getWjxCredentials(env = process.env) {
    // 1. Per-request credentials from registered provider (e.g. AsyncLocalStorage)
    const providerCreds = _credentialProvider?.();
    if (providerCreds)
        return providerCreds;
    // 2. Fallback: environment variables (single-tenant / stdio / CLI mode)
    const apiKey = env.WJX_API_KEY;
    if (!apiKey) {
        throw new Error("WJX_API_KEY must be set (via env var or credential provider).");
    }
    return { apiKey };
}
function isRetryable(status) {
    return status === 429 || status >= 500;
}
const MAX_RETRY_BUDGET = 10_000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const MAX_RETRY_DELAY_MS = 30_000;
function normalizeRetryBudget(opts) {
    const value = opts.retryBudget ?? opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_RETRY_BUDGET) {
        const name = opts.retryBudget !== undefined ? "retryBudget" : "maxRetries";
        throw new TypeError(`${name} must be a finite safe integer between 0 and ${MAX_RETRY_BUDGET}`);
    }
    return value;
}
function normalizeTimeoutMs(value) {
    const timeoutMs = value ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
        throw new TypeError(`timeoutMs must be a finite positive safe integer between 1 and ${MAX_TIMEOUT_MS}`);
    }
    return timeoutMs;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function _callApi(baseUrl, params, opts = {}) {
    const credentials = opts.credentials ?? getWjxCredentials();
    const fetchImpl = opts.fetchImpl ?? fetch;
    const timeoutMs = normalizeTimeoutMs(opts.timeoutMs);
    const maxRetries = normalizeRetryBudget(opts);
    const logger = opts.logger;
    const traceId = opts.traceId ?? generateTraceId();
    const action = String(params.action ?? "unknown");
    const url = `${baseUrl}?traceid=${traceId}&action=${encodeURIComponent(action)}`;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
            const delay = Math.min(MAX_RETRY_DELAY_MS, RETRY_DELAY_MS * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5));
            logger?.warn(`[wjx] retry ${attempt}/${maxRetries} for action=${action} traceid=${traceId} after ${delay}ms`);
            await sleep(delay);
        }
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            let response;
            try {
                const headers = {
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
                response = await fetchImpl(url, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(params),
                    signal: controller.signal,
                });
            }
            finally {
                clearTimeout(timer);
            }
            if (!response.ok) {
                if (isRetryable(response.status) && attempt < maxRetries) {
                    lastError = new Error(`WJX API request failed with ${response.status} ${response.statusText}`);
                    continue;
                }
                throw new Error(`WJX API request failed with ${response.status} ${response.statusText}`);
            }
            let result;
            try {
                result = (await response.json());
            }
            catch (parseError) {
                throw new Error(`WJX API returned unparseable response for action=${action} traceid=${traceId}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }
            if (result.result === false) {
                logger?.error(`[wjx] api error action=${action} traceid=${traceId}: ${result.errormsg}`);
            }
            return result;
        }
        catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                lastError = new Error(`WJX API request timed out after ${timeoutMs}ms (action=${action}, traceid=${traceId})`);
                if (attempt < maxRetries)
                    continue;
                throw lastError;
            }
            const isNetworkError = error instanceof TypeError &&
                typeof error.message === "string" &&
                /fetch|network|connect|ECONN|ETIMEDOUT|EAI_AGAIN/i.test(error.message);
            if (isNetworkError && attempt < maxRetries) {
                lastError = error;
                continue;
            }
            throw error;
        }
    }
    throw lastError ?? new Error("Exhausted retries");
}
export async function callWjxApi(params, opts = {}) {
    return _callApi(getWjxApiUrl(opts.baseUrl ?? opts.credentials?.baseUrl), params, opts);
}
export async function callWjxUserSystemApi(params, opts = {}) {
    return _callApi(getWjxUserSystemApiUrl(opts.baseUrl ?? opts.credentials?.baseUrl), params, opts);
}
export async function callWjxSubuserApi(params, opts = {}) {
    return _callApi(getWjxSubuserApiUrl(opts.baseUrl ?? opts.credentials?.baseUrl), params, opts);
}
export async function callWjxContactsApi(params, opts = {}) {
    return _callApi(getWjxContactsApiUrl(opts.baseUrl ?? opts.credentials?.baseUrl), params, opts);
}
export function getCorpId(env = process.env) {
    return env.WJX_CORP_ID || undefined;
}
/**
 * Copy defined (non-undefined) keys from source to target.
 * Replaces repetitive `if (input.x !== undefined) params.x = input.x` patterns.
 */
export function assignDefined(target, source, keys) {
    const src = source;
    for (const k of keys) {
        if (src[k] !== undefined)
            target[k] = src[k];
    }
    return target;
}
//# sourceMappingURL=api-client.js.map