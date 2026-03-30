import type { WjxApiResponse, WjxCredentials, FetchLike } from "../../core/types.js";
import { Action } from "../../core/constants.js";
import { callWjxApi, getWjxCredentials, validateQuestionsJson } from "../../core/api-client.js";
import type {
  CreateSurveyInput,
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

export async function createSurvey<T = unknown>(
  input: CreateSurveyInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.CREATE_SURVEY,
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

  return callWjxApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
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
      additional_setting: input.additional_setting ?? "[1000,1001,1002,1003,1004,1005]",
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
