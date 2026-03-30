import type { WjxApiResponse, WjxCredentials, FetchLike } from "../../core/types.js";
import { Action } from "../../core/constants.js";
import { callWjxContactsApi, getWjxCredentials, getCorpId } from "../../core/api-client.js";
import type {
  QueryContactsInput,
  AddContactsInput,
  DeleteContactsInput,
  AddAdminInput,
  DeleteAdminInput,
  RestoreAdminInput,
  ListDepartmentsInput,
  AddDepartmentInput,
  ModifyDepartmentInput,
  DeleteDepartmentInput,
  ListTagsInput,
  AddTagInput,
  ModifyTagInput,
  DeleteTagInput,
} from "./types.js";

function resolveCorpId(input: { corpid?: string }): string {
  const corpid = input.corpid || getCorpId();
  if (!corpid) {
    throw new Error("corpid is required: set WJX_CORP_ID env var or pass corpid parameter");
  }
  return corpid;
}

export async function queryContacts<T = unknown>(
  input: QueryContactsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.QUERY_CONTACTS,
    corpid: resolveCorpId(input),
    uid: input.uid,
  };

  return callWjxContactsApi<T>(params, { credentials, fetchImpl });
}

export async function addContacts<T = unknown>(
  input: AddContactsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.ADD_CONTACTS,
    corpid: resolveCorpId(input),
    users: input.users,
  };
  if (input.auto_create_udept !== undefined) params.auto_create_udept = input.auto_create_udept ? "1" : "0";
  if (input.auto_create_tag !== undefined) params.auto_create_tag = input.auto_create_tag ? "1" : "0";

  return callWjxContactsApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

export async function deleteContacts<T = unknown>(
  input: DeleteContactsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxContactsApi<T>(
    {
      action: Action.MANAGE_CONTACTS,
      corpid: resolveCorpId(input),
      uids: input.uids,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}

// ─── Admin ───────────────────────────────────────────────────────────

export async function addAdmin<T = unknown>(
  input: AddAdminInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxContactsApi<T>(
    {
      action: Action.ADD_ADMIN,
      corpid: resolveCorpId(input),
      users: input.users,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}

export async function deleteAdmin<T = unknown>(
  input: DeleteAdminInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxContactsApi<T>(
    {
      action: Action.DELETE_ADMIN,
      corpid: resolveCorpId(input),
      uids: input.uids,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}

export async function restoreAdmin<T = unknown>(
  input: RestoreAdminInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxContactsApi<T>(
    {
      action: Action.RESTORE_ADMIN,
      corpid: resolveCorpId(input),
      uids: input.uids,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}

// ─── Department ──────────────────────────────────────────────────────

export async function listDepartments<T = unknown>(
  input: ListDepartmentsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.LIST_DEPARTMENTS,
    corpid: resolveCorpId(input),
  };
  return callWjxContactsApi<T>(params, { credentials, fetchImpl });
}

export async function addDepartment<T = unknown>(
  input: AddDepartmentInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxContactsApi<T>(
    {
      action: Action.ADD_DEPARTMENT,
      corpid: resolveCorpId(input),
      depts: input.depts,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}

export async function modifyDepartment<T = unknown>(
  input: ModifyDepartmentInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxContactsApi<T>(
    {
      action: Action.MODIFY_DEPARTMENT,
      corpid: resolveCorpId(input),
      depts: input.depts,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}

export async function deleteDepartment<T = unknown>(
  input: DeleteDepartmentInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.DELETE_DEPARTMENT,
    corpid: resolveCorpId(input),
    type: input.type,
    depts: input.depts,
  };
  if (input.del_child !== undefined) params.del_child = input.del_child ? "1" : "0";

  return callWjxContactsApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

// ─── Tag ─────────────────────────────────────────────────────────────

export async function listTags<T = unknown>(
  input: ListTagsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxContactsApi<T>(
    {
      action: Action.LIST_TAGS,
      corpid: resolveCorpId(input),
    },
    { credentials, fetchImpl },
  );
}

export async function addTag<T = unknown>(
  input: AddTagInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.ADD_TAG,
    corpid: resolveCorpId(input),
    child_names: input.child_names,
  };
  if (input.is_radio !== undefined) params.is_radio = input.is_radio ? "1" : "0";

  return callWjxContactsApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

export async function modifyTag<T = unknown>(
  input: ModifyTagInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  const params: Record<string, unknown> = {
    action: Action.MODIFY_TAG,
    corpid: resolveCorpId(input),
    tp_id: input.tp_id,
  };
  if (input.tp_name !== undefined) params.tp_name = input.tp_name;
  if (input.child_names !== undefined) params.child_names = input.child_names;

  return callWjxContactsApi<T>(params, { credentials, fetchImpl, maxRetries: 0 });
}

export async function deleteTag<T = unknown>(
  input: DeleteTagInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
): Promise<WjxApiResponse<T>> {
  return callWjxContactsApi<T>(
    {
      action: Action.DELETE_TAG,
      corpid: resolveCorpId(input),
      type: input.type,
      tags: input.tags,
    },
    { credentials, fetchImpl, maxRetries: 0 },
  );
}
