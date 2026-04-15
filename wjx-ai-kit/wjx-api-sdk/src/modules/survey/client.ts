import type { WjxApiResponse, WjxCredentials, FetchLike } from "../../core/types.js";
import { Action, LONG_TIMEOUT_MS } from "../../core/constants.js";
import { callWjxApi, getWjxCredentials, assignDefined } from "../../core/api-client.js";
export { textToSurvey, parsedQuestionsToWire } from "./text-to-survey.js";
import { textToSurvey, parsedQuestionsToWire } from "./text-to-survey.js";
export { jsonToSurvey, jsonQuestionsToWire } from "./json-to-survey.js";
import { jsonToSurvey, jsonQuestionsToWire } from "./json-to-survey.js";
import type {
  CreateSurveyInput,
  CreateSurveyByTextInput,
  CreateSurveyByJsonInput,
  GetSurveyInput,
  ListSurveysInput,
  UpdateSurveyStatusInput,
  GetSurveySettingsInput,
  UpdateSurveySettingsInput,
  DeleteSurveyInput,
  GetQuestionTagsInput,
  GetTagDetailsInput,
  ClearRecycleBinInput,
  UploadFileInput,
} from "./types.js";

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

async function createSurveyWithAction<T = unknown>(
  input: CreateSurveyInput,
  action: string,
  credentials: WjxCredentials,
  fetchImpl: FetchLike,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action,
    title: input.title,
  };
  if (input.source_vid !== undefined) {
    params.source_vid = input.source_vid;
  } else {
    params.atype = input.type;
    params.desc = input.description;
    params.questions = input.questions;
    validateQuestionsJson(input.questions);
  }
  params.publish = input.publish ?? false;
  if (input.creater !== undefined) params.creater = input.creater;
  if (input.compress_img !== undefined) params.compress_img = input.compress_img;
  if (input.is_string !== undefined) params.is_string = input.is_string;

  return callWjxApi<T>(params, {
    credentials,
    fetchImpl,
    maxRetries: 0,
    timeoutMs: LONG_TIMEOUT_MS,
  });
}

export async function createSurvey<T = unknown>(
  input: CreateSurveyInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return createSurveyWithAction<T>(input, Action.CREATE_SURVEY, credentials, fetchImpl);
}

export async function getSurvey<T = unknown>(
  input: GetSurveyInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.GET_SURVEY,
    vid: input.vid,
    get_questions: input.get_questions ?? true,
    get_items: input.get_items ?? true,
  };
  if (input.get_exts !== undefined) params.get_exts = input.get_exts;
  if (input.get_setting !== undefined) params.get_setting = input.get_setting;
  if (input.get_page_cut !== undefined) params.get_page_cut = input.get_page_cut;
  if (input.get_tags !== undefined) params.get_tags = input.get_tags;
  if (input.showtitle !== undefined) params.showtitle = input.showtitle;

  return callWjxApi<T>(params, { credentials, fetchImpl });
}

export async function listSurveys<T = unknown>(
  input: ListSurveysInput = {},
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.LIST_SURVEYS,
    page_index: input.page_index ?? 1,
    page_size: input.page_size ?? 10,
  };
  if (input.status !== undefined) params.status = input.status;
  if (input.atype !== undefined) params.atype = input.atype;
  if (input.name_like !== undefined && input.name_like !== "") params.name_like = input.name_like;
  if (input.sort !== undefined) params.sort = input.sort;
  if (input.creater !== undefined) params.creater = input.creater;
  if (input.folder !== undefined) params.folder = input.folder;
  if (input.is_xingbiao !== undefined) params.is_xingbiao = input.is_xingbiao;
  if (input.query_all !== undefined) params.query_all = input.query_all;
  if (input.verify_status !== undefined) params.verify_status = input.verify_status;
  if (input.time_type !== undefined) params.time_type = input.time_type;
  if (input.begin_time !== undefined) params.begin_time = input.begin_time;
  if (input.end_time !== undefined) params.end_time = input.end_time;

  return callWjxApi<T>(params, { credentials, fetchImpl });
}

export async function updateSurveyStatus<T = unknown>(
  input: UpdateSurveyStatusInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.UPDATE_STATUS,
      vid: input.vid,
      state: input.state,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}

export async function getSurveySettings<T = unknown>(
  input: GetSurveySettingsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.GET_SETTINGS,
      vid: input.vid,
      additional_setting: input.additional_setting ?? "[1000,1001,1002,1003,1004,1005,1006,1007]",
    },
    { credentials, fetchImpl },
  );
}

export async function updateSurveySettings<T = unknown>(
  input: UpdateSurveySettingsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.UPDATE_SETTINGS,
    vid: input.vid,
  };
  if (input.api_setting !== undefined) params.api_setting = input.api_setting;
  if (input.after_submit_setting !== undefined) params.after_submit_setting = input.after_submit_setting;
  if (input.msg_setting !== undefined) params.msg_setting = input.msg_setting;
  if (input.sojumpparm_setting !== undefined) params.sojumpparm_setting = input.sojumpparm_setting;
  if (input.time_setting !== undefined) params.time_setting = input.time_setting;

  return callWjxApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

export async function deleteSurvey<T = unknown>(
  input: DeleteSurveyInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.DELETE_SURVEY,
    vid: input.vid,
    username: input.username,
  };
  if (input.completely_delete !== undefined) params.completely_delete = input.completely_delete;

  return callWjxApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

export async function getQuestionTags<T = unknown>(
  input: GetQuestionTagsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    { action: Action.GET_TAGS, username: input.username },
    { credentials, fetchImpl },
  );
}

export async function getTagDetails<T = unknown>(
  input: GetTagDetailsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    { action: Action.GET_TAG_DETAILS, tag_id: input.tag_id },
    { credentials, fetchImpl },
  );
}

export async function clearRecycleBin<T = unknown>(
  input: ClearRecycleBinInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.CLEAR_RECYCLE_BIN,
    username: input.username,
  };
  if (input.vid !== undefined) params.vid = input.vid;

  return callWjxApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

/**
 * 通过 DSL 文本创建问卷（客户端解析 DSL 后调用 createSurvey API）。
 * 段落说明题会被自动过滤（API 不支持 q_type=2）。
 */
export async function createSurveyByText<T = unknown>(
  input: CreateSurveyByTextInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  // 解析 DSL 文本为结构化数据，然后通过 createSurvey API 创建
  const parsed = textToSurvey(input.text);
  const { questions: wireQuestions } = parsedQuestionsToWire(parsed.questions);
  const title = input.title ?? parsed.title;
  const description = parsed.description ?? "";

  return createSurvey<T>(
    {
      title,
      type: input.atype ?? 1,
      description,
      questions: JSON.stringify(wireQuestions),
      publish: input.publish,
      creater: input.creater,
    },
    credentials,
    fetchImpl,
  );
}

/**
 * 通过 JSONL 格式创建问卷（客户端解析 JSONL 后调用问卷创建 OpenAPI，action 1000106）。
 * 不支持的题型会被跳过（记录在返回结果中）。
 */
export async function createSurveyByJson<T = unknown>(
  input: CreateSurveyByJsonInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const jsonl = input.jsonl.trim();
  if (!jsonl) {
    throw new Error("jsonl must not be empty");
  }
  // 校验 JSONL 可被本地解析（题型映射错误时 jsonQuestionsToWire 会丢弃题目）
  const parsed = jsonToSurvey(input.jsonl);
  jsonQuestionsToWire(parsed.questions);
  const title = input.title ?? parsed.title;
  const description = parsed.description ?? "";

  // OpenAPI 1000106：远端按 JSONL 解析，参数字段名为 surveydatajson（非 questions）
  return callWjxApi<T>(
    {
      action: Action.CREATE_SURVEY_BY_JSON,
      title,
      atype: input.atype ?? 1,
      desc: description,
      surveydatajson: jsonl,
      publish: input.publish ?? false,
      ...(input.creater !== undefined ? { creater: input.creater } : {}),
    },
    {
      credentials,
      fetchImpl,
      maxRetries: 0,
      timeoutMs: LONG_TIMEOUT_MS,
    },
  );
}

export async function uploadFile<T = unknown>(
  input: UploadFileInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.UPLOAD_FILE,
      file_name: input.file_name,
      file: input.file,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}
