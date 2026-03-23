export interface QueryContactsInput {
  corpid?: string;
  uid: string;
}

export interface AddContactsInput {
  corpid?: string;
  users: string; // JSON array of user objects
  auto_create_udept?: boolean;
  auto_create_tag?: boolean;
}

export interface DeleteContactsInput {
  corpid?: string;
  uids: string; // comma-separated user IDs
}

// ─── Admin ───────────────────────────────────────────────────────────

export interface AddAdminInput {
  corpid?: string;
  users: string; // JSON array of admin objects
}

export interface DeleteAdminInput {
  corpid?: string;
  uids: string; // comma-separated admin user IDs
}

export interface RestoreAdminInput {
  corpid?: string;
  uids: string; // comma-separated admin user IDs
}

// ─── Department ──────────────────────────────────────────────────────

export interface ListDepartmentsInput {
  corpid?: string;
  page_index?: number;
  page_size?: number;
}

export interface AddDepartmentInput {
  corpid?: string;
  depts: string; // JSON array of department path strings
}

export interface ModifyDepartmentInput {
  corpid?: string;
  depts: string; // JSON array of department objects [{id, name, parentid}]
}

export interface DeleteDepartmentInput {
  corpid?: string;
  type: string; // "1" = by ID, "2" = by name
  depts: string; // JSON array of department identifiers
  del_child?: boolean;
}

// ─── Tag ─────────────────────────────────────────────────────────────

export interface ListTagsInput {
  corpid?: string;
}

export interface AddTagInput {
  corpid?: string;
  child_names: string; // JSON array of "group/tag" strings
}

export interface ModifyTagInput {
  corpid?: string;
  tp_id: string;
  tp_name?: string;
  child_names?: string; // JSON array of tag objects
}

export interface DeleteTagInput {
  corpid?: string;
  type: string; // "1" = by ID, "2" = by name
  tags: string; // JSON array of tag identifiers
}
