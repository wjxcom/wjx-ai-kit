import type { WjxApiResponse, WjxCredentials, FetchLike, SignableRecord } from "../../core/types.js";
import { Action } from "../../core/constants.js";
import { callWjxApi, getWjxCredentials } from "../../core/api-client.js";
import type {
  QueryContactsInput,
  AddContactsInput,
  ManageContactsInput,
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

// ─── Admin ───────────────────────────────────────────────────────────

export async function addAdmin<T = unknown>(
  input: AddAdminInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.ADD_ADMIN,
    username: input.username,
    admin_name: input.admin_name,
  };
  if (input.mobile !== undefined) params.mobile = input.mobile;
  if (input.email !== undefined) params.email = input.email;
  if (input.role !== undefined) params.role = input.role;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}

export async function deleteAdmin<T = unknown>(
  input: DeleteAdminInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.DELETE_ADMIN,
      username: input.username,
      admin_id: input.admin_id,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}

export async function restoreAdmin<T = unknown>(
  input: RestoreAdminInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.RESTORE_ADMIN,
      username: input.username,
      admin_id: input.admin_id,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}

// ─── Department ──────────────────────────────────────────────────────

export async function listDepartments<T = unknown>(
  input: ListDepartmentsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.LIST_DEPARTMENTS,
    username: input.username,
  };
  if (input.page_index !== undefined) params.page_index = input.page_index;
  if (input.page_size !== undefined) params.page_size = input.page_size;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp });
}

export async function addDepartment<T = unknown>(
  input: AddDepartmentInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.ADD_DEPARTMENT,
    username: input.username,
    name: input.name,
  };
  if (input.parent_id !== undefined) params.parent_id = input.parent_id;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}

export async function modifyDepartment<T = unknown>(
  input: ModifyDepartmentInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  const params: SignableRecord = {
    action: Action.MODIFY_DEPARTMENT,
    username: input.username,
    dept_id: input.dept_id,
  };
  if (input.name !== undefined) params.name = input.name;
  if (input.parent_id !== undefined) params.parent_id = input.parent_id;

  return callWjxApi<T>(params, { credentials, fetchImpl, timestamp, maxRetries: 0 });
}

export async function deleteDepartment<T = unknown>(
  input: DeleteDepartmentInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.DELETE_DEPARTMENT,
      username: input.username,
      dept_id: input.dept_id,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}

// ─── Tag ─────────────────────────────────────────────────────────────

export async function listTags<T = unknown>(
  input: ListTagsInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.LIST_TAGS,
      username: input.username,
    },
    { credentials, fetchImpl, timestamp },
  );
}

export async function addTag<T = unknown>(
  input: AddTagInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.ADD_TAG,
      username: input.username,
      tag_name: input.tag_name,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}

export async function modifyTag<T = unknown>(
  input: ModifyTagInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.MODIFY_TAG,
      username: input.username,
      tag_id: input.tag_id,
      tag_name: input.tag_name,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}

export async function deleteTag<T = unknown>(
  input: DeleteTagInput,
  credentials: WjxCredentials = getWjxCredentials(),
  fetchImpl: FetchLike = fetch,
  timestamp?: string,
): Promise<WjxApiResponse<T>> {
  return callWjxApi<T>(
    {
      action: Action.DELETE_TAG,
      username: input.username,
      tag_id: input.tag_id,
    },
    { credentials, fetchImpl, timestamp, maxRetries: 0 },
  );
}
