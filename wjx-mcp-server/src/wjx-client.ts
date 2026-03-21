import { randomUUID } from "node:crypto";
import { withSignature } from "./sign.js";

export const WJX_API_URL = "https://www.wjx.cn/openapi/default.aspx";

export const Action = {
  GET_SURVEY: "1000001",
  LIST_SURVEYS: "1000002",
  CREATE_SURVEY: "1000101",
  UPDATE_STATUS: "1000102",
} as const;

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

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function getUnixTimestamp(): string {
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
  try {
    JSON.parse(questions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`questions must be valid JSON: ${message}`);
  }
}

type SignableRecord = Record<string, string | number | boolean | null | undefined>;

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWjxApi<T = unknown>(
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
  const url = `${WJX_API_URL}?traceid=${traceId}&action=${action}`;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
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

      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signed),
        signal: controller.signal,
      });

      clearTimeout(timer);

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
        error instanceof TypeError && /fetch|network/i.test(error.message);
      if (isNetworkError && attempt < maxRetries) {
        lastError = error as Error;
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("Exhausted retries");
}

// ─── Create Survey (1000101) ────────────────────────────────────────

export interface CreateSurveyInput {
  title: string;
  type: number;
  description: string;
  publish?: boolean;
  questions: string;
}

export interface CreateSurveyParams {
  action: string;
  appid: string;
  atype: number;
  desc: string;
  publish: boolean;
  questions: string;
  title: string;
  ts: string;
  sign: string;
}

/** @internal Test helper — builds signed params without traceid (production uses callWjxApi) */
export function buildCreateSurveyParams(
  input: CreateSurveyInput,
  credentials: WjxCredentials,
  timestamp: string = getUnixTimestamp(),
): CreateSurveyParams {
  validateQuestionsJson(input.questions);

  const signableParams = {
    action: Action.CREATE_SURVEY,
    appid: credentials.appId,
    atype: input.type,
    desc: input.description,
    publish: input.publish ?? false,
    questions: input.questions,
    title: input.title,
    ts: timestamp,
  };

  return withSignature(signableParams, credentials.appKey) as CreateSurveyParams;
}

export async function createSurvey<T = unknown>(
  input: CreateSurveyInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  validateQuestionsJson(input.questions);

  return callWjxApi<T>(
    {
      action: Action.CREATE_SURVEY,
      atype: input.type,
      desc: input.description,
      publish: input.publish ?? false,
      questions: input.questions,
      title: input.title,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}

// ─── Get Survey (1000001) ───────────────────────────────────────────

export interface GetSurveyInput {
  vid: number;
  get_questions?: boolean;
  get_items?: boolean;
}

export async function getSurvey<T = unknown>(
  input: GetSurveyInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.GET_SURVEY,
      vid: input.vid,
      get_questions: input.get_questions ?? true,
      get_items: input.get_items ?? true,
    },
    { credentials, fetchImpl, timestamp },
  );
}

// ─── List Surveys (1000002) ─────────────────────────────────────────

export interface ListSurveysInput {
  page_index?: number;
  page_size?: number;
  status?: number;
  atype?: number;
  name_like?: string;
  sort?: number;
}

export async function listSurveys<T = unknown>(
  input: ListSurveysInput = {},
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.LIST_SURVEYS,
    page_index: input.page_index ?? 1,
    page_size: input.page_size ?? 10,
  };
  if (input.status !== undefined) params.status = input.status;
  if (input.atype !== undefined) params.atype = input.atype;
  if (input.name_like) params.name_like = input.name_like;
  if (input.sort !== undefined) params.sort = input.sort;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp });
}

// ─── Update Survey Status (1000102) ─────────────────────────────────

export interface UpdateSurveyStatusInput {
  vid: number;
  state: number; // 1=发布, 2=暂停, 3=删除
}

export async function updateSurveyStatus<T = unknown>(
  input: UpdateSurveyStatusInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.UPDATE_STATUS,
      vid: input.vid,
      state: input.state,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}
