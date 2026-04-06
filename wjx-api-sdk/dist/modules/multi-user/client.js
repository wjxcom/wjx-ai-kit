import { Action } from "../../core/constants.js";
import { callWjxSubuserApi, getWjxCredentials, assignDefined } from "../../core/api-client.js";
export async function addSubAccount(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.ADD_SUB_ACCOUNT,
        subuser: input.subuser,
    };
    assignDefined(params, input, ["password", "mobile", "email", "role", "group"]);
    return callWjxSubuserApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function modifySubAccount(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.MODIFY_SUB_ACCOUNT,
        subuser: input.subuser,
    };
    assignDefined(params, input, ["mobile", "email", "role", "group"]);
    return callWjxSubuserApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function deleteSubAccount(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxSubuserApi({
        action: Action.DELETE_SUB_ACCOUNT,
        subuser: input.subuser,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
export async function restoreSubAccount(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.RESTORE_SUB_ACCOUNT,
        subuser: input.subuser,
    };
    assignDefined(params, input, ["mobile", "email"]);
    return callWjxSubuserApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function querySubAccounts(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.QUERY_SUB_ACCOUNTS,
    };
    assignDefined(params, input, ["subuser", "name_like", "role", "group", "status", "mobile"]);
    return callWjxSubuserApi(params, { credentials, fetchImpl });
}
//# sourceMappingURL=client.js.map