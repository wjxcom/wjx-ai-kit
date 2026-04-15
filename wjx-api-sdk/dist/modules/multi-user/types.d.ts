export interface AddSubAccountInput {
    subuser: string;
    password?: string;
    mobile?: string;
    email?: string;
    role?: number;
    group?: number;
}
export interface ModifySubAccountInput {
    subuser: string;
    mobile?: string;
    email?: string;
    role?: number;
    group?: number;
}
export interface DeleteSubAccountInput {
    subuser: string;
}
export interface RestoreSubAccountInput {
    subuser: string;
    mobile?: string;
    email?: string;
}
export interface QuerySubAccountsInput {
    subuser?: string;
    name_like?: string;
    role?: number;
    group?: number;
    status?: boolean;
    mobile?: string;
}
