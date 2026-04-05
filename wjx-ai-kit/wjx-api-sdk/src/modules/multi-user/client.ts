import type { WjxApiResponse, WjxCredentials, FetchLike } from "../../core/types.js";
import { Action } from "../../core/constants.js";
import { callWjxSubuserApi, getWjxCredentials, assignDefined } from "../../core/api-client.js";
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
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.ADD_SUB_ACCOUNT,
    subuser: input.subuser,
  };
  assignDefined(params, input, ["password", "mobile", "email", "role", "group"]);

  return callWjxSubuserApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

export async function modifySubAccount<T = unknown>(
  input: ModifySubAccountInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.MODIFY_SUB_ACCOUNT,
    subuser: input.subuser,
  };
  assignDefined(params, input, ["mobile", "email", "role", "group"]);

  return callWjxSubuserApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

export async function deleteSubAccount<T = unknown>(
  input: DeleteSubAccountInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxSubuserApi<T>(
    {
      action: Action.DELETE_SUB_ACCOUNT,
      subuser: input.subuser,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}

export async function restoreSubAccount<T = unknown>(
  input: RestoreSubAccountInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.RESTORE_SUB_ACCOUNT,
    subuser: input.subuser,
  };
  assignDefined(params, input, ["mobile", "email"]);

  return callWjxSubuserApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

export async function querySubAccounts<T = unknown>(
  input: QuerySubAccountsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.QUERY_SUB_ACCOUNTS,
  };
  assignDefined(params, input, ["subuser", "name_like", "role", "group", "status", "mobile"]);

  return callWjxSubuserApi<T>(params, { credentials, fetchImpl });
}
