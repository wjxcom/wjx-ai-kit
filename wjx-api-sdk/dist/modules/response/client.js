import { Action, LONG_TIMEOUT_MS } from "../../core/constants.js";
import { callWjxApi, getWjxCredentials, assignDefined } from "../../core/api-client.js";
export async function queryResponses(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.QUERY_RESPONSES,
        vid: input.vid,
    };
    assignDefined(params, input, [
        "valid", "page_index", "page_size", "sort", "min_index", "jid",
        "sojumpparm", "qid", "begin_time", "end_time", "file_view_expires",
        "query_note", "distinct_user", "distinct_sojumpparm", "conds",
    ]);
    return callWjxApi(params, { credentials, fetchImpl });
}
export async function queryResponsesRealtime(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.QUERY_RESPONSES_REALTIME,
        vid: input.vid,
    };
    if (input.count !== undefined)
        params.count = input.count;
    return callWjxApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function downloadResponses(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.DOWNLOAD_RESPONSES,
        vid: input.vid,
    };
    assignDefined(params, input, [
        "taskid", "valid", "query_count", "begin_time", "end_time",
        "min_index", "qid", "sort", "query_type", "suffix", "query_record",
    ]);
    return callWjxApi(params, { credentials, fetchImpl, timeoutMs: LONG_TIMEOUT_MS });
}
export async function getReport(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.GET_REPORT,
        vid: input.vid,
    };
    assignDefined(params, input, [
        "valid", "min_index", "jid", "sojumpparm", "begin_time", "end_time",
        "distinct_user", "distinct_sojumpparm", "conds",
    ]);
    return callWjxApi(params, { credentials, fetchImpl, timeoutMs: LONG_TIMEOUT_MS });
}
export async function submitResponse(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.SUBMIT_RESPONSE,
        vid: input.vid,
        inputcosttime: input.inputcosttime,
        submitdata: input.submitdata,
    };
    assignDefined(params, input, ["udsid", "sojumpparm", "submittime"]);
    return callWjxApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function getFileLinks(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.GET_FILE_LINKS,
        vid: input.vid,
        file_keys: input.file_keys,
    };
    assignDefined(params, input, ["file_view_expires"]);
    return callWjxApi(params, { credentials, fetchImpl });
}
export async function getWinners(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.GET_WINNERS,
        vid: input.vid,
    };
    assignDefined(params, input, ["atype", "awardstatus", "page_index", "page_size"]);
    return callWjxApi(params, { credentials, fetchImpl });
}
export async function modifyResponse(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxApi({
        action: Action.MODIFY_RESPONSE,
        vid: input.vid,
        jid: input.jid,
        type: input.type,
        answers: input.answers,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
export async function get360Report(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.GET_360_REPORT,
        vid: input.vid,
    };
    assignDefined(params, input, ["taskid"]);
    return callWjxApi(params, { credentials, fetchImpl, maxRetries: 0, timeoutMs: LONG_TIMEOUT_MS });
}
export async function clearResponses(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxApi({
        action: Action.CLEAR_RESPONSES,
        username: input.username,
        vid: input.vid,
        reset_to_zero: input.reset_to_zero,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
//# sourceMappingURL=client.js.map