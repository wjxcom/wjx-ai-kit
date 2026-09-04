import type { WjxApiResponse, WjxCredentials, FetchLike, RequestOverrides } from "../../core/types.js";
import { Action, LONG_TIMEOUT_MS } from "../../core/constants.js";
import { callWjxApi, getWjxCredentials } from "../../core/api-client.js";
import type { AiPageResult, CreateAiPageInput, UpdateAiPageInput } from "./types.js";

const MAX_HTML_LENGTH = 200_000;
const MAX_TITLE_LENGTH = 100;

function resolveHtml(input: { html_content?: string; html?: string }): string {
  const html = input.html_content ?? input.html;
  if (typeof html !== "string" || html.length === 0) {
    throw new TypeError("html_content is required (html is accepted as a compatibility alias)");
  }
  if (html.length > MAX_HTML_LENGTH) {
    throw new TypeError(`html_content must not exceed ${MAX_HTML_LENGTH} characters`);
  }
  return html;
}

function validateTitle(title: string | undefined): void {
  if (title === undefined) return;
  if (typeof title !== "string" || title.length > MAX_TITLE_LENGTH) {
    throw new TypeError(`title must not exceed ${MAX_TITLE_LENGTH} characters`);
  }
  if (title.includes("问卷星")) {
    throw new TypeError('title must not contain "问卷星"');
  }
}

function validatePageType(pageType: number | undefined): void {
  if (pageType === undefined) return;
  if (!Number.isInteger(pageType) || pageType < 0 || pageType > 2) {
    throw new TypeError("page_type must be 0 (web), 1 (poster), or 2 (PPT)");
  }
}

function normalizeTraditionalVid(vid: string | number): string | number {
  if (typeof vid === "number") {
    if (!Number.isInteger(vid) || vid <= 0) throw new TypeError("vid must be a positive traditional numeric vid");
    return vid;
  }
  const normalized = vid.trim();
  if (!/^\d+$/.test(normalized) || Number(normalized) <= 0) {
    throw new TypeError("vid must be a traditional numeric vid; sid values are not accepted");
  }
  return normalized;
}

export async function createAiPage<T = AiPageResult>(
  input: CreateAiPageInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  requestOptions?: RequestOverrides,
): Promise<WjxApiResponse<T>> {
  if (!input || typeof input !== "object") throw new TypeError("input must be an object");
  const html = resolveHtml(input);
  validateTitle(input.title);
  validatePageType(input.page_type);
  return callWjxApi<T>({
    action: Action.CREATE_AI_PAGE,
    html_content: html,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.page_type === undefined ? {} : { page_type: input.page_type }),
    ...(input.publish === undefined ? {} : { publish: input.publish }),
    ...(input.creater === undefined ? {} : { creater: input.creater }),
  }, { ...requestOptions, credentials, fetchImpl, maxRetries: 0, timeoutMs: requestOptions?.timeoutMs ?? LONG_TIMEOUT_MS });
}

export async function updateAiPage<T = AiPageResult>(
  input: UpdateAiPageInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  requestOptions?: RequestOverrides,
): Promise<WjxApiResponse<T>> {
  if (!input || typeof input !== "object") throw new TypeError("input must be an object");
  const html = resolveHtml(input);
  validateTitle(input.title);
  validatePageType(input.page_type);
  return callWjxApi<T>({
    action: Action.UPDATE_AI_PAGE,
    vid: normalizeTraditionalVid(input.vid),
    html_content: html,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.page_type === undefined ? {} : { page_type: input.page_type }),
  }, { ...requestOptions, credentials, fetchImpl, maxRetries: 0, timeoutMs: requestOptions?.timeoutMs ?? LONG_TIMEOUT_MS });
}
