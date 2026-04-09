import { Action, LONG_TIMEOUT_MS } from "../../core/constants.js";
import { callWjxUserSystemApi, getWjxCredentials, assignDefined } from "../../core/api-client.js";
export async function addParticipants(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.ADD_PARTICIPANTS,
        users: input.users,
        sysid: input.sysid,
    };
    if (input.auto_create_udept !== undefined)
        params.auto_create_udept = input.auto_create_udept;
    return callWjxUserSystemApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function modifyParticipants(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.MODIFY_PARTICIPANTS,
        users: input.users,
        sysid: input.sysid,
    };
    if (input.auto_create_udept !== undefined)
        params.auto_create_udept = input.auto_create_udept;
    return callWjxUserSystemApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function deleteParticipants(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxUserSystemApi({
        action: Action.DELETE_PARTICIPANTS,
        uids: input.uids,
        sysid: input.sysid,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
export async function bindActivity(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.BIND_ACTIVITY,
        vid: input.vid,
        sysid: input.sysid,
        uids: input.uids,
    };
    assignDefined(params, input, ["answer_times", "can_chg_answer", "can_view_result", "can_hide_qlist"]);
    return callWjxUserSystemApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function querySurveyBinding(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.QUERY_SURVEY_BINDING,
        vid: input.vid,
        sysid: input.sysid,
    };
    assignDefined(params, input, ["join_status", "day", "week", "month", "force_join_times"]);
    return callWjxUserSystemApi(params, { credentials, fetchImpl, timeoutMs: LONG_TIMEOUT_MS });
}
export async function queryUserSurveys(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.QUERY_USER_SURVEYS,
        uid: input.uid,
        sysid: input.sysid,
    };
    return callWjxUserSystemApi(params, { credentials, fetchImpl });
}
//# sourceMappingURL=client.js.map