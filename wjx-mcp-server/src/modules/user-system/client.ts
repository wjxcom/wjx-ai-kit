import type { WjxApiResponse, WjxCredentials, FetchLike, SignableRecord } from "../../core/types.js";
import { Action } from "../../core/constants.js";
import { callWjxUserSystemApi, getWjxCredentials } from "../../core/api-client.js";
import type {
  AddParticipantsInput,
  ModifyParticipantsInput,
  DeleteParticipantsInput,
  QuerySurveyBindingInput,
  QueryUserSurveysInput,
} from "./types.js";

export async function addParticipants<T = unknown>(
  input: AddParticipantsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxUserSystemApi<T>(
    {
      action: Action.ADD_PARTICIPANTS,
      username: input.username,
      users: input.users,
      sysid: input.sysid,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}

export async function modifyParticipants<T = unknown>(
  input: ModifyParticipantsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxUserSystemApi<T>(
    {
      action: Action.MODIFY_PARTICIPANTS,
      username: input.username,
      users: input.users,
      sysid: input.sysid,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}

export async function deleteParticipants<T = unknown>(
  input: DeleteParticipantsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxUserSystemApi<T>(
    {
      action: Action.DELETE_PARTICIPANTS,
      username: input.username,
      uids: input.uids,
      sysid: input.sysid,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}

export async function querySurveyBinding<T = unknown>(
  input: QuerySurveyBindingInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.QUERY_SURVEY_BINDING,
    username: input.username,
    vid: input.vid,
    sysid: input.sysid,
  };
  if (input.page_index !== undefined) params.page_index = input.page_index;
  if (input.page_size !== undefined) params.page_size = input.page_size;

  return callWjxUserSystemApi<T>(params, { credentials, fetchImpl, timestamp });
}

export async function queryUserSurveys<T = unknown>(
  input: QueryUserSurveysInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.QUERY_USER_SURVEYS,
    username: input.username,
    uid: input.uid,
    sysid: input.sysid,
  };
  if (input.page_index !== undefined) params.page_index = input.page_index;
  if (input.page_size !== undefined) params.page_size = input.page_size;

  return callWjxUserSystemApi<T>(params, { credentials, fetchImpl, timestamp });
}
