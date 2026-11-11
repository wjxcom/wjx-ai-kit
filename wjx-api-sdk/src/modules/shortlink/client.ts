import { getWjxShortLinkUrl } from "../../core/constants.js";
import type { FetchLike, RequestOverrides, WjxCredentials } from "../../core/types.js";
import type { GetShortLinkInput, ShortLinkResponse } from "./types.js";

const MAX_TIMEOUT_MS = 2_147_483_647;

function validateSurveyUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("url must be a non-empty survey URL");
  }

  const trimmed = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new TypeError("url must be a valid survey URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new TypeError("url must use http or https");
  }

  // Official domains and custom domains both occur in deployments. The
  // respondent path is the reliable discriminator for a survey URL.
  const surveyPath = /^\/(?:m|vm|jq)\/[^/?#]+\.aspx$/i.test(parsed.pathname);
  if (!surveyPath) {
    throw new TypeError("url must be a 问卷星 survey URL (/m/<id>.aspx, /vm/<id>.aspx, or /jq/<id>.aspx)");
  }
  return trimmed;
}

/** Convert a respondent-facing WJX survey URL into a short link. */
export async function getShortLink(
  input: GetShortLinkInput,
  credentials?: WjxCredentials,
  fetchImpl: FetchLike = fetch,
  requestOptions: RequestOverrides = {},
): Promise<ShortLinkResponse> {
  const surveyUrl = validateSurveyUrl(input?.url);
  const requestBaseUrl = typeof requestOptions.baseUrl === "string" && requestOptions.baseUrl.trim()
    ? requestOptions.baseUrl
    : credentials?.baseUrl;
  const endpoint = new URL(getWjxShortLinkUrl(requestBaseUrl));
  endpoint.searchParams.set("url", surveyUrl);

  const timeoutMs = requestOptions.timeoutMs ?? 15_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new TypeError(`timeoutMs must be a finite positive safe integer between 1 and ${MAX_TIMEOUT_MS}`);
  }
  const controller = new AbortController();
  let rejectTimeout!: (reason: unknown) => void;
  const timeoutError = new Error(`WJX shortlink request timed out after ${timeoutMs}ms`);
  const timeoutPromise = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
  });
  const timer = setTimeout(() => {
    controller.abort();
    rejectTimeout(timeoutError);
  }, timeoutMs);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    const apiKey = credentials?.apiKey?.trim();
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (requestOptions.clientName?.trim()) headers["X-WJX-Client"] = requestOptions.clientName.trim();
    if (requestOptions.clientVersion?.trim()) headers["X-WJX-Client-Version"] = requestOptions.clientVersion.trim();

    let response: Response;
    try {
      response = await Promise.race([
        fetchImpl(endpoint, { method: "GET", headers, signal: controller.signal }),
        timeoutPromise,
      ]);
    } catch (error) {
      if (error === timeoutError || controller.signal.aborted) {
        throw timeoutError;
      }
      throw error;
    }
    if (!response.ok) {
      try {
        await Promise.race([response.body?.cancel() ?? Promise.resolve(), timeoutPromise]);
      } catch (error) {
        if (error === timeoutError) throw timeoutError;
        // Preserve the original HTTP status error if body cleanup fails.
      }
      throw new Error(`WJX shortlink request failed with ${response.status} ${response.statusText}`);
    }

    let body: unknown;
    try {
      body = await Promise.race([response.json(), timeoutPromise]);
    } catch (error) {
      if (error === timeoutError || controller.signal.aborted) throw timeoutError;
      throw new Error(`WJX shortlink endpoint returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("WJX shortlink endpoint returned an invalid response object");
    }
    const result = body as Record<string, unknown>;
    if (typeof result.success !== "boolean") {
      throw new Error("WJX shortlink endpoint returned an invalid success field");
    }
    if (result.success && (typeof result.data !== "string" || !result.data.trim())) {
      throw new Error("WJX shortlink endpoint returned an invalid data field");
    }
    return result as ShortLinkResponse;
  } finally {
    clearTimeout(timer);
  }
}
