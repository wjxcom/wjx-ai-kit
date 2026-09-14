import { callWjxApi, getWjxCredentials } from "../../core/api-client.js";
import { Action, LONG_TIMEOUT_MS } from "../../core/constants.js";
import { CREATABLE_SURVEY_ATYPES } from "../survey/client.js";
import { generateWjxDsl } from "./validate.js";
function assertValidDsl(dsl) {
    const result = generateWjxDsl(dsl);
    if (!result.valid)
        throw new TypeError(result.diagnostics.map((item) => item.message).join("；"));
    return result.dsl;
}
function assertCreatableAtype(atype) {
    if (!Number.isSafeInteger(atype) || !CREATABLE_SURVEY_ATYPES.has(atype)) {
        throw new TypeError(`当前接口不支持创建 atype=${atype} 类型的问卷`);
    }
}
export async function queryWjxDsl(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxApi({
        action: Action.QUERY_WJX_DSL,
        vid: input.vid,
        get_questions: input.get_questions ?? true,
        get_items: input.get_items ?? true,
        ...(input.get_exts === undefined ? {} : { get_exts: input.get_exts }),
        ...(input.get_setting === undefined ? {} : { get_setting: input.get_setting }),
        ...(input.get_page_cut === undefined ? {} : { get_page_cut: input.get_page_cut }),
        ...(input.get_tags === undefined ? {} : { get_tags: input.get_tags }),
        ...(input.showtitle === undefined ? {} : { showtitle: input.showtitle }),
    }, { credentials, fetchImpl });
}
export async function createSurveyByWjxDsl(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    if (!input || typeof input.dsl !== "string")
        throw new TypeError("dsl must be a string");
    if (input.atype !== undefined)
        assertCreatableAtype(input.atype);
    const dsl = assertValidDsl(input.dsl);
    return callWjxApi({
        action: Action.CREATE_SURVEY_BY_WJX_DSL,
        dsl,
        ...(input.atype === undefined ? {} : { atype: input.atype }),
        ...(input.publish === undefined ? {} : { publish: input.publish }),
        ...(input.compress_img === undefined ? {} : { compress_img: input.compress_img }),
    }, { credentials, fetchImpl, maxRetries: 0, timeoutMs: LONG_TIMEOUT_MS });
}
export async function updateWjxDsl(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    if (!input || typeof input.dsl !== "string")
        throw new TypeError("dsl must be a string");
    if (input.vid === undefined || input.vid === null || String(input.vid).trim() === "")
        throw new TypeError("vid must be provided");
    const dsl = assertValidDsl(input.dsl);
    return callWjxApi({
        action: Action.UPDATE_WJX_DSL,
        vid: input.vid,
        dsl,
        ...((input.allow_breaking_changes ?? input.allowBreakingChanges) === undefined
            ? {}
            : { allow_breaking_changes: (input.allow_breaking_changes ?? input.allowBreakingChanges) }),
    }, { credentials, fetchImpl, maxRetries: 0, timeoutMs: LONG_TIMEOUT_MS });
}
//# sourceMappingURL=client.js.map