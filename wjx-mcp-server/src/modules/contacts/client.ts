import type { WjxApiResponse, WjxCredentials, FetchLike, SignableRecord } from "../../core/types.js";
import { Action } from "../../core/constants.js";
import { callWjxApi, getWjxCredentials } from "../../core/api-client.js";
import type {
  QueryContactsInput,
  AddContactsInput,
  ManageContactsInput,
} from "./types.js";

export async function queryContacts<T = unknown>(
  input: QueryContactsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.QUERY_CONTACTS,
    username: input.username,
  };
  if (input.dept_id !== undefined) params.dept_id = input.dept_id;
  if (input.page_index !== undefined) params.page_index = input.page_index;
  if (input.page_size !== undefined) params.page_size = input.page_size;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp });
}

export async function addContacts<T = unknown>(
  input: AddContactsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.ADD_CONTACTS,
      username: input.username,
      members: input.members,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}

export async function manageContacts<T = unknown>(
  input: ManageContactsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.MANAGE_CONTACTS,
      username: input.username,
      operation: input.operation,
      members: input.members,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}
