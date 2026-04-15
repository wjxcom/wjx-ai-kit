import { Action } from "../../core/constants.js";
import { callWjxContactsApi, getWjxCredentials, getCorpId } from "../../core/api-client.js";
function resolveCorpId(input) {
    const corpid = input.corpid || getCorpId();
    if (!corpid) {
        throw new Error("corpid is required: set WJX_CORP_ID env var or pass corpid parameter");
    }
    return corpid;
}
export async function queryContacts(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.QUERY_CONTACTS,
        corpid: resolveCorpId(input),
        uid: input.uid,
    };
    return callWjxContactsApi(params, { credentials, fetchImpl });
}
export async function addContacts(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.ADD_CONTACTS,
        corpid: resolveCorpId(input),
        users: input.users,
    };
    if (input.auto_create_udept !== undefined)
        params.auto_create_udept = input.auto_create_udept ? "1" : "0";
    if (input.auto_create_tag !== undefined)
        params.auto_create_tag = input.auto_create_tag ? "1" : "0";
    return callWjxContactsApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function deleteContacts(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxContactsApi({
        action: Action.MANAGE_CONTACTS,
        corpid: resolveCorpId(input),
        uids: input.uids,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
// ─── Admin ───────────────────────────────────────────────────────────
export async function addAdmin(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxContactsApi({
        action: Action.ADD_ADMIN,
        corpid: resolveCorpId(input),
        users: input.users,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
export async function deleteAdmin(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxContactsApi({
        action: Action.DELETE_ADMIN,
        corpid: resolveCorpId(input),
        uids: input.uids,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
export async function restoreAdmin(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxContactsApi({
        action: Action.RESTORE_ADMIN,
        corpid: resolveCorpId(input),
        uids: input.uids,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
// ─── Department ──────────────────────────────────────────────────────
export async function listDepartments(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.LIST_DEPARTMENTS,
        corpid: resolveCorpId(input),
    };
    return callWjxContactsApi(params, { credentials, fetchImpl });
}
export async function addDepartment(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxContactsApi({
        action: Action.ADD_DEPARTMENT,
        corpid: resolveCorpId(input),
        depts: input.depts,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
export async function modifyDepartment(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxContactsApi({
        action: Action.MODIFY_DEPARTMENT,
        corpid: resolveCorpId(input),
        depts: input.depts,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
export async function deleteDepartment(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.DELETE_DEPARTMENT,
        corpid: resolveCorpId(input),
        type: input.type,
        depts: input.depts,
    };
    if (input.del_child !== undefined)
        params.del_child = input.del_child ? "1" : "0";
    return callWjxContactsApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
// ─── Tag ─────────────────────────────────────────────────────────────
export async function listTags(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxContactsApi({
        action: Action.LIST_TAGS,
        corpid: resolveCorpId(input),
    }, { credentials, fetchImpl });
}
export async function addTag(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.ADD_TAG,
        corpid: resolveCorpId(input),
        child_names: input.child_names,
    };
    if (input.is_radio !== undefined)
        params.is_radio = input.is_radio ? "1" : "0";
    return callWjxContactsApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function modifyTag(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.MODIFY_TAG,
        corpid: resolveCorpId(input),
        tp_id: input.tp_id,
    };
    if (input.tp_name !== undefined)
        params.tp_name = input.tp_name;
    if (input.child_names !== undefined)
        params.child_names = input.child_names;
    return callWjxContactsApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function deleteTag(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxContactsApi({
        action: Action.DELETE_TAG,
        corpid: resolveCorpId(input),
        type: input.type,
        tags: input.tags,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
//# sourceMappingURL=client.js.map