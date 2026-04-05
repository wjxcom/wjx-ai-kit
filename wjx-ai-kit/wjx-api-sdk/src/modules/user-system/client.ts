import type { WjxApiResponse, WjxCredentials, FetchLike } from "../../core/types.js";
import { Action } from "../../core/constants.js";
import { callWjxUserSystemApi, getWjxCredentials, assignDefined } from "../../core/api-client.js";
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
  const params: Record<string, unknown> = {
    action: Action.MODIFY_PARTICIPANTS,
    users: input.users,
    sysid: input.sysid,
  };
  if (input.auto_create_udept !== undefined) params.auto_create_udept = input.auto_create_udept;

  return callWjxUserSystemApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

export async function deleteParticipants<T = unknown>(
  input: DeleteParticipantsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxUserSystemApi<T>(
    {
      action: Action.DELETE_PARTICIPANTS,
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
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.BIND_ACTIVITY,
    vid: input.vid,
    sysid: input.sysid,
    uids: input.uids,
  };
  assignDefined(params, input, ["answer_times", "can_chg_answer", "can_view_result", "can_hide_qlist"]);

  return callWjxUserSystemApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

export async function querySurveyBinding<T = unknown>(
  input: QuerySurveyBindingInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.QUERY_SURVEY_BINDING,
    vid: input.vid,
    sysid: input.sysid,
  };
  assignDefined(params, input, ["join_status", "day", "week", "month", "force_join_times"]);

  return callWjxUserSystemApi<T>(params, { credentials, fetchImpl });
}

export async function queryUserSurveys<T = unknown>(
  input: QueryUserSurveysInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.QUERY_USER_SURVEYS,
    uid: input.uid,
    sysid: input.sysid,
  };

  return callWjxUserSystemApi<T>(params, { credentials, fetchImpl });
}
