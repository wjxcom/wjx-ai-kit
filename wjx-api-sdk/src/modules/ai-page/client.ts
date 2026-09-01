import type { WjxApiResponse, WjxCredentials, FetchLike } from "../../core/types.js";
import { Action, LONG_TIMEOUT_MS } from "../../core/constants.js";
import { callWjxApi, getWjxCredentials } from "../../core/api-client.js";
import type { AiPageResult, CreateAiPageInput, UpdateAiPageInput } from "./types.js";

const MAX_HTML_LENGTH = 200_000;
const MAX_TITLE_LENGTH = 100;

function resolveHtml(input: { html_content?: string; html?: string }): string {
  const html = input.html_content ?? input.html;
  if (typeof html !== "string" || html.length === 0) {
    throw new Error("html_content is required (html is accepted as a compatibility alias)");
  }
  if (html.length > MAX_HTML_LENGTH) {
    throw new Error(`html_content must not exceed ${MAX_HTML_LENGTH} characters`);
  }
  return html;
}

function validateTitle(title: string | undefined): void {
  if (title === undefined) return;
  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(`title must not exceed ${MAX_TITLE_LENGTH} characters`);
  }
  if (title.includes("问卷星")) {
    throw new Error('title must not contain "问卷星"');
  }
}

function validatePageType(pageType: number | undefined): void {
  if (pageType === undefined) return;
  if (!Number.isInteger(pageType) || pageType < 0 || pageType > 2) {
    throw new Error("page_type must be 0 (web), 1 (poster), or 2 (PPT)");
  }
}

function normalizeTraditionalVid(vid: string | number): string | number {
  if (typeof vid === "number") {
    if (!Number.isInteger(vid) || vid <= 0) {
      throw new Error("vid must be a positive traditional numeric vid");
    }
    return vid;
  }

  const normalized = vid.trim();
  if (!/^\d+$/.test(normalized) || Number(normalized) <= 0) {
    throw new Error("vid must be a traditional numeric vid; sid values are not accepted");
  }
  return normalized;
}

export async function createAiPage<T = AiPageResult>(
  input: CreateAiPageInput,
  credentials?: WjxCredentials,
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const html = resolveHtml(input);
  validateTitle(input.title);
  validatePageType(input.page_type);

  const params: Record<string, unknown> = {
    action: Action.CREATE_AI_PAGE,
    html_content: html,
    publish: input.publish ?? false,
  };
  if (input.title !== undefined) params.title = input.title;
  if (input.page_type !== undefined) params.page_type = input.page_type;
  if (input.creater !== undefined) params.creater = input.creater;

  return callWjxApi<T>(params, {
    credentials: credentials ?? getWjxCredentials(),
    fetchImpl,
    maxRetries: 0,
    timeoutMs: LONG_TIMEOUT_MS,
    legacyJsonTransport: true,
  });
}

export async function updateAiPage<T = AiPageResult>(
  input: UpdateAiPageInput,
  credentials?: WjxCredentials,
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const html = resolveHtml(input);
  validateTitle(input.title);
  validatePageType(input.page_type);

  const params: Record<string, unknown> = {
    action: Action.UPDATE_AI_PAGE,
    vid: normalizeTraditionalVid(input.vid),
    html_content: html,
  };
  if (input.title !== undefined) params.title = input.title;
  if (input.page_type !== undefined) params.page_type = input.page_type;

  return callWjxApi<T>(params, {
    credentials: credentials ?? getWjxCredentials(),
    fetchImpl,
    maxRetries: 0,
    timeoutMs: LONG_TIMEOUT_MS,
    legacyJsonTransport: true,
  });
}
