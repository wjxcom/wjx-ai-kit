import type { WjxApiResponse, WjxCredentials, FetchLike, SignableRecord } from "../../core/types.js";
import { Action } from "../../core/constants.js";
import { callWjxSubuserApi, getWjxCredentials } from "../../core/api-client.js";
import type {
  AddSubAccountInput,
  ModifySubAccountInput,
  DeleteSubAccountInput,
  RestoreSubAccountInput,
  QuerySubAccountsInput,
} from "./types.js";

export async function addSubAccount<T = unknown>(
  input: AddSubAccountInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.ADD_SUB_ACCOUNT,
    subuser: input.subuser,
  };
  if (input.password !== undefined) params.password = input.password;
  if (input.mobile !== undefined) params.mobile = input.mobile;
  if (input.email !== undefined) params.email = input.email;
  if (input.role !== undefined) params.role = input.role;
  if (input.group !== undefined) params.group = input.group;

  return callWjxSubuserApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}

export async function modifySubAccount<T = unknown>(
  input: ModifySubAccountInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.MODIFY_SUB_ACCOUNT,
    subuser: input.subuser,
  };
  if (input.mobile !== undefined) params.mobile = input.mobile;
  if (input.email !== undefined) params.email = input.email;
  if (input.role !== undefined) params.role = input.role;
  if (input.group !== undefined) params.group = input.group;

  return callWjxSubuserApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}

export async function deleteSubAccount<T = unknown>(
  input: DeleteSubAccountInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxSubuserApi<T>(
    {
      action: Action.DELETE_SUB_ACCOUNT,
      subuser: input.subuser,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}

export async function restoreSubAccount<T = unknown>(
  input: RestoreSubAccountInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.RESTORE_SUB_ACCOUNT,
    subuser: input.subuser,
  };
  if (input.mobile !== undefined) params.mobile = input.mobile;
  if (input.email !== undefined) params.email = input.email;

  return callWjxSubuserApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}

export async function querySubAccounts<T = unknown>(
  input: QuerySubAccountsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.QUERY_SUB_ACCOUNTS,
  };
  if (input.subuser !== undefined) params.subuser = input.subuser;
  if (input.name_like !== undefined) params.name_like = input.name_like;
  if (input.role !== undefined) params.role = input.role;
  if (input.group !== undefined) params.group = input.group;
  if (input.status !== undefined) params.status = input.status;
  if (input.page_index !== undefined) params.page_index = input.page_index;
  if (input.page_size !== undefined) params.page_size = input.page_size;
  if (input.mobile !== undefined) params.mobile = input.mobile;

  return callWjxSubuserApi<T>(params, { credentials, fetchImpl, timestamp });
}
