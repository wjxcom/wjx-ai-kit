import { withSignature } from "./sign.js";

export const WJX_API_URL = "https://www.wjx.cn/openapi/default.aspx";
export const CREATE_SURVEY_ACTION = "1000101";

export interface CreateSurveyInput {
  title: string;
  type: number;
  description: string;
  publish?: boolean;
  questions: string;
}

export interface WjxCredentials {
  appId: string;
  appKey: string;
}

export interface CreateSurveyParams {
  action: string;
  appid: string;
  atype: number;
  desc: string;
  encode: "SHA1";
  publish: boolean;
  questions: string;
  title: string;
  ts: string;
  sign: string;
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

function getUnixTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
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

export function buildCreateSurveyParams(
  input: CreateSurveyInput,
  credentials: WjxCredentials,
  timestamp: string = getUnixTimestamp(),
): CreateSurveyParams {
  validateQuestionsJson(input.questions);

  return withSignature(
    {
      action: CREATE_SURVEY_ACTION,
      appid: credentials.appId,
      atype: input.type,
      desc: input.description,
      encode: "SHA1" as const,
      publish: input.publish ?? false,
      questions: input.questions,
      title: input.title,
      ts: timestamp,
    },
    credentials.appKey,
  );
}

export async function createSurvey<T = unknown>(
  input: CreateSurveyInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const body = buildCreateSurveyParams(input, credentials, timestamp);
  const response = await fetchImpl(WJX_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `WJX API request failed with ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as WjxApiResponse<T>;
}
