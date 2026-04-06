export interface QueryContactsInput {
    corpid?: string;
    uid: string;
}
export interface AddContactsInput {
    corpid?: string;
    users: string;
    auto_create_udept?: boolean;
    auto_create_tag?: boolean;
}
export interface DeleteContactsInput {
    corpid?: string;
    uids: string;
}
export interface AddAdminInput {
    corpid?: string;
    users: string;
}
export interface DeleteAdminInput {
    corpid?: string;
    uids: string;
}
export interface RestoreAdminInput {
    corpid?: string;
    uids: string;
}
export interface ListDepartmentsInput {
    corpid?: string;
}
export interface AddDepartmentInput {
    corpid?: string;
    depts: string;
}
export interface ModifyDepartmentInput {
    corpid?: string;
    depts: string;
}
export interface DeleteDepartmentInput {
    corpid?: string;
    type: string;
    depts: string;
    del_child?: boolean;
}
export interface ListTagsInput {
    corpid?: string;
}
export interface AddTagInput {
    corpid?: string;
    child_names: string;
    is_radio?: boolean;
}
export interface ModifyTagInput {
    corpid?: string;
    tp_id: string;
    tp_name?: string;
    child_names?: string;
}
export interface DeleteTagInput {
    corpid?: string;
    type: string;
    tags: string;
}
