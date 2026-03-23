export interface QueryContactsInput {
  username: string;
  dept_id?: number;
  page_index?: number;
  page_size?: number;
}

export interface AddContactsInput {
  username: string;
  members: string; // JSON array of member objects
}

export interface ManageContactsInput {
  username: string;
  operation: "update" | "delete";
  members: string; // JSON array: for update, member objects with id; for delete, array of member IDs
}

// ─── Admin ───────────────────────────────────────────────────────────

export interface AddAdminInput {
  username: string;
  admin_name: string;
  mobile?: string;
  email?: string;
  role?: string;
}

export interface DeleteAdminInput {
  username: string;
  admin_id: number;
}

export interface RestoreAdminInput {
  username: string;
  admin_id: number;
}

// ─── Department ──────────────────────────────────────────────────────

export interface ListDepartmentsInput {
  username: string;
  page_index?: number;
  page_size?: number;
}

export interface AddDepartmentInput {
  username: string;
  name: string;
  parent_id?: number;
}

export interface ModifyDepartmentInput {
  username: string;
  dept_id: number;
  name?: string;
  parent_id?: number;
}

export interface DeleteDepartmentInput {
  username: string;
  dept_id: number;
}

// ─── Tag ─────────────────────────────────────────────────────────────

export interface ListTagsInput {
  username: string;
}

export interface AddTagInput {
  username: string;
  tag_name: string;
}

export interface ModifyTagInput {
  username: string;
  tag_id: number;
  tag_name: string;
}

export interface DeleteTagInput {
  username: string;
  tag_id: number;
}
