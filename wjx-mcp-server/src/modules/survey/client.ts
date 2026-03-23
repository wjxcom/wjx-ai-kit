import type { WjxApiResponse, WjxCredentials, FetchLike, RequestOptions, SignableRecord } from "../../core/types.js";
import { Action } from "../../core/constants.js";
import { callWjxApi, getWjxCredentials, validateQuestionsJson, getUnixTimestamp } from "../../core/api-client.js";
import { withSignature } from "../../core/sign.js";
import type {
  CreateSurveyInput,
  CreateSurveyParams,
  GetSurveyInput,
  ListSurveysInput,
  UpdateSurveyStatusInput,
  GetSurveySettingsInput,
  UpdateSurveySettingsInput,
  DeleteSurveyInput,
  GetQuestionTagsInput,
  GetTagDetailsInput,
  ClearRecycleBinInput,
} from "./types.js";

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
  if (input.name_like !== undefined && input.name_like !== "") params.name_like = input.name_like;
  if (input.sort !== undefined) params.sort = input.sort;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp });
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

export async function getSurveySettings<T = unknown>(
  input: GetSurveySettingsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.GET_SETTINGS,
      vid: input.vid,
      additional_setting: input.additional_setting ?? "[1000,1001,1002,1003,1004,1005]",
    },
    { credentials, fetchImpl, timestamp },
  );
}

export async function updateSurveySettings<T = unknown>(
  input: UpdateSurveySettingsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.UPDATE_SETTINGS,
    vid: input.vid,
  };
  if (input.api_setting !== undefined) params.api_setting = input.api_setting;
  if (input.after_submit_setting !== undefined) params.after_submit_setting = input.after_submit_setting;
  if (input.msg_setting !== undefined) params.msg_setting = input.msg_setting;
  if (input.sojumpparm_setting !== undefined) params.sojumpparm_setting = input.sojumpparm_setting;
  if (input.time_setting !== undefined) params.time_setting = input.time_setting;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}

export async function deleteSurvey<T = unknown>(
  input: DeleteSurveyInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.DELETE_SURVEY,
    vid: input.vid,
    username: input.username,
  };
  if (input.completely_delete !== undefined) params.completely_delete = input.completely_delete;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}

export async function getQuestionTags<T = unknown>(
  input: GetQuestionTagsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    { action: Action.GET_TAGS, username: input.username },
    { credentials, fetchImpl, timestamp },
  );
}

export async function getTagDetails<T = unknown>(
  input: GetTagDetailsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    { action: Action.GET_TAG_DETAILS, tag_id: input.tag_id },
    { credentials, fetchImpl, timestamp },
  );
}

export async function clearRecycleBin<T = unknown>(
  input: ClearRecycleBinInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.CLEAR_RECYCLE_BIN,
    username: input.username,
  };
  if (input.vid !== undefined) params.vid = input.vid;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}
