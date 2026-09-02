import type { WjxApiResponse, WjxCredentials, FetchLike, RequestOverrides } from "../../core/types.js";
import { Action, LONG_TIMEOUT_MS } from "../../core/constants.js";
import { callWjxApi, getWjxCredentials, assignDefined } from "../../core/api-client.js";
export { extractJsonlMetadata, normalizeJsonl } from "./json-to-survey.js";
import {
  extractJsonlMetadata,
  normalizeJsonl,
  MAX_JSONL_SIZE,
  preprocessExamJsonl,
  hasVoteJsonlQtype,
  injectDefaultRequir,
  injectAtypeIntoJsonl,
  inferAtypeFromTitle,
  validateSurveyTitle,
  validateSurveyHasQuestions,
  validateExplicitOptionalQuestionsInJsonl,
  preflightJsonl,
  parseJsonl,
  resolveJsonlPublish,
} from "./json-to-survey.js";
import type {
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

// User-system surveys are a legacy maintenance boundary and cannot be
// created through the JSONL create API.
const DISABLED_CREATE_SURVEY_ATYPES = new Set<number>([8]);

function assertCreatableSurveyAtype(atype: number): void {
  if (DISABLED_CREATE_SURVEY_ATYPES.has(atype)) {
    throw new Error(`当前接口不支持创建 atype=${atype} 类型的问卷。`);
  }
}


export async function getSurvey<T = unknown>(
  input: GetSurveyInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  requestOptions?: RequestOverrides,
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

  return callWjxApi<T>(params, { ...requestOptions, credentials, fetchImpl });
}

export async function listSurveys<T = unknown>(
  input: ListSurveysInput = {},
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  requestOptions?: RequestOverrides,
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

  return callWjxApi<T>(params, { ...requestOptions, credentials, fetchImpl });
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
 * 通过 JSONL 格式创建问卷（纯透传到服务端 action 1000106）。
 * 客户端负责输入边界和 JSONL 语法校验，服务端负责最终题型落库。
 */
export async function createSurveyByJson<T = unknown>(
  input: CreateSurveyByJsonInput,
  credentials?: WjxCredentials,
  fetchImpl: FetchLike = fetch,
  requestOptions?: RequestOverrides,
): Promise<WjxApiResponse<T>> {
  if (!input || typeof input.jsonl !== "string") {
    throw new TypeError("jsonl must be a string");
  }
  if (input.title !== undefined && typeof input.title !== "string") {
    throw new TypeError("title must be a string");
  }
  const jsonl = normalizeJsonl(input.jsonl.trim());
  if (!jsonl) {
    throw new Error("jsonl must not be empty");
  }
  const inputByteLength = Buffer.byteLength(jsonl, "utf8");
  if (inputByteLength > MAX_JSONL_SIZE) {
    throw new Error(`jsonl exceeds maximum size of ${MAX_JSONL_SIZE} bytes (${inputByteLength})`);
  }

  // 预检：拦截英文/拼错/错字段名的 qtype，给出精确的中文修复建议
  // 必须在 preprocessExamJsonl 等预处理之前跑，这样错误信息里的行号与用户输入一致
  preflightJsonl(jsonl);
  // 预检会跳过无法解析的行以便继续提供 qtype 诊断；创建前必须严格拒绝这些行，
  // 防止坏数据原样进入服务端。
  parseJsonl(jsonl);

  // 考试题型预处理：注入 isquiz="1"，并在用户未指定 atype 时推断为 6（考试）
  const { jsonl: examProcessed, hasExam } = preprocessExamJsonl(jsonl);
  validateExplicitOptionalQuestionsInJsonl(examProcessed, input.optionalTitles);
  // 默认必答预处理：与页面创建行为保持一致，为题目行注入 requir=true（未指定时）
  const requirInjected = injectDefaultRequir(examProcessed);
  const metadata = extractJsonlMetadata(requirInjected);
  const title = input.title ?? metadata.title;
  const description = metadata.description ?? "";

  // 标题合理性校验：空/占位符/过短/黑名单全部拦截，给出可执行修复建议
  validateSurveyTitle(title);

  // 题目数校验：JSONL 至少包含 1 道真实题目（排除元数据/分页/段落/知情同意书）
  validateSurveyHasQuestions(requirInjected);

  const hasVote = hasVoteJsonlQtype(requirInjected);

  // atype 推断优先级：显式入参 > JSONL 元数据 atype > 考试题型 > 投票题型 > 标题关键字 > 1（调查）
  const atype =
    input.atype ??
    metadata.atype ??
    (hasExam ? 6 : hasVote ? 3 : inferAtypeFromTitle(title) ?? 1);

  assertCreatableSurveyAtype(atype);

  // 关键修复：服务端 action 1000106 实际只读 JSONL 内的 atype，忽略顶层字段。
  // 必须把最终 atype 注入「问卷基础信息」行，否则页面落库会一律变成 atype=1。
  const processedJsonl = injectAtypeIntoJsonl(requirInjected, atype);
  const processedByteLength = Buffer.byteLength(processedJsonl, "utf8");
  if (processedByteLength > MAX_JSONL_SIZE) {
    throw new Error(`jsonl exceeds maximum size of ${MAX_JSONL_SIZE} bytes after preprocessing (${processedByteLength})`);
  }
  // Resolve credentials only after all local validation so malformed input is
  // reported consistently even when the caller has not configured an API key.
  const resolvedCredentials = credentials ?? getWjxCredentials();

  return callWjxApi<T>(
    {
      action: Action.CREATE_SURVEY_BY_JSON,
      title,
      atype,
      desc: description,
      surveydatajson: processedJsonl,
      publish: resolveJsonlPublish(processedJsonl, input.publish),
      ...(input.creater !== undefined ? { creater: input.creater } : {}),
    },
    {
      ...requestOptions,
      credentials: resolvedCredentials,
      fetchImpl,
      retryBudget: 0,
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
