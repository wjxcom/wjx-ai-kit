import type { WjxApiResponse, WjxCredentials, FetchLike } from "../../core/types.js";
import { Action } from "../../core/constants.js";
import { callWjxUserSystemApi, getWjxCredentials } from "../../core/api-client.js";
import type {
  AddParticipantsInput,
  ModifyParticipantsInput,
  DeleteParticipantsInput,
  BindActivityInput,
  QuerySurveyBindingInput,
  QueryUserSurveysInput,
} from "./types.js";

export async function addParticipants<T = unknown>(
  input: AddParticipantsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxUserSystemApi<T>(
    {
      action: Action.ADD_PARTICIPANTS,
      username: input.username,
      users: input.users,
      sysid: input.sysid,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}

export async function modifyParticipants<T = unknown>(
  input: ModifyParticipantsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxUserSystemApi<T>(
    {
      action: Action.MODIFY_PARTICIPANTS,
      username: input.username,
      users: input.users,
      sysid: input.sysid,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}

export async function deleteParticipants<T = unknown>(
  input: DeleteParticipantsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxUserSystemApi<T>(
    {
      action: Action.DELETE_PARTICIPANTS,
      username: input.username,
      uids: input.uids,
      sysid: input.sysid,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}

export async function bindActivity<T = unknown>(
  input: BindActivityInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.BIND_ACTIVITY,
    username: input.username,
    vid: input.vid,
    sysid: input.sysid,
    uids: input.uids,
  };
  if (input.answer_times !== undefined) params.answer_times = input.answer_times;
  if (input.can_chg_answer !== undefined) params.can_chg_answer = input.can_chg_answer;
  if (input.can_view_result !== undefined) params.can_view_result = input.can_view_result;
  if (input.can_hide_qlist !== undefined) params.can_hide_qlist = input.can_hide_qlist;

  return callWjxUserSystemApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}

export async function querySurveyBinding<T = unknown>(
  input: QuerySurveyBindingInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.QUERY_SURVEY_BINDING,
    username: input.username,
    vid: input.vid,
    sysid: input.sysid,
  };
  if (input.page_index !== undefined) params.page_index = input.page_index;
  if (input.page_size !== undefined) params.page_size = input.page_size;
  if (input.join_status !== undefined) params.join_status = input.join_status;
  if (input.day !== undefined) params.day = input.day;
  if (input.week !== undefined) params.week = input.week;
  if (input.month !== undefined) params.month = input.month;
  if (input.force_join_times !== undefined) params.force_join_times = input.force_join_times;

  return callWjxUserSystemApi<T>(params, { credentials, fetchImpl });
}

export async function queryUserSurveys<T = unknown>(
  input: QueryUserSurveysInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.QUERY_USER_SURVEYS,
    username: input.username,
    uid: input.uid,
    sysid: input.sysid,
  };
  if (input.page_index !== undefined) params.page_index = input.page_index;
  if (input.page_size !== undefined) params.page_size = input.page_size;

  return callWjxUserSystemApi<T>(params, { credentials, fetchImpl });
}
