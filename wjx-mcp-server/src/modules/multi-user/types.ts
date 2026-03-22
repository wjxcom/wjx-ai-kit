export interface AddSubAccountInput {
  username: string;
  subuser: string;
  password: string;
  mobile?: string;
  email?: string;
  role_id?: number;
}

export interface ModifySubAccountInput {
  username: string;
  subuser: string;
  password?: string;
  mobile?: string;
  email?: string;
  role_id?: number;
}

export interface DeleteSubAccountInput {
  username: string;
  subuser: string;
}

export interface RestoreSubAccountInput {
  username: string;
  subuser: string;
}

export interface QuerySubAccountsInput {
  username: string;
  page_index?: number;
  page_size?: number;
}
