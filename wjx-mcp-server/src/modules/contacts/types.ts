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
