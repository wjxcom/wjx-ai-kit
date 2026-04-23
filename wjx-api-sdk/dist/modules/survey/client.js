import { Action, LONG_TIMEOUT_MS } from "../../core/constants.js";
import { callWjxApi, getWjxCredentials } from "../../core/api-client.js";
export { textToSurvey, parsedQuestionsToWire } from "./text-to-survey.js";
import { textToSurvey, parsedQuestionsToWire } from "./text-to-survey.js";
export { extractJsonlMetadata, normalizeJsonl } from "./json-to-survey.js";
import { extractJsonlMetadata, normalizeJsonl, MAX_JSONL_SIZE, preprocessExamJsonl, injectDefaultRequir, injectAtypeIntoJsonl, inferAtypeFromTitle, validateSurveyTitle, validateSurveyHasQuestions, } from "./json-to-survey.js";
const DISABLED_CREATE_SURVEY_ATYPES = new Set([3]);
const FORM_BLOCKED_SUBTYPES = new Map([
    [706, "表格数值"],
    [707, "表格填空"],
    [708, "表格下拉框"],
    [709, "表格组合"],
    [710, "自增表格"],
]);
const FORM_BLOCKED_JSONL_QTYPES = new Map([
    ["矩阵数值题", "表格数值"],
    ["表格数值", "表格数值"],
    ["表格填空题", "表格填空"],
    ["表格填空", "表格填空"],
    ["表格下拉框", "表格下拉框"],
    ["表格组合题", "表格组合"],
    ["表格组合", "表格组合"],
    ["表格自增题", "自增表格"],
    ["自增表格", "自增表格"],
]);
function assertCreatableSurveyAtype(atype) {
    if (DISABLED_CREATE_SURVEY_ATYPES.has(atype)) {
        throw new Error("当前接口不支持创建投票类型问卷，请改用调查、测评、考试或表单类型。");
    }
}
function parseQuestionsJsonArray(questions) {
    let parsed;
    try {
        parsed = JSON.parse(questions);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`questions must be valid JSON: ${message}`);
    }
    if (!Array.isArray(parsed)) {
        throw new Error("questions must be a JSON array");
    }
    const questionList = parsed;
    for (const [i, q] of questionList.entries()) {
        if (typeof q.q_index !== "number") {
            throw new Error(`questions[${i}] missing required field "q_index" (number)`);
        }
        if (typeof q.q_type !== "number") {
            throw new Error(`questions[${i}] missing required field "q_type" (number)`);
        }
    }
    return questionList;
}
function normalizeQuestionsForCreate(questions, atype) {
    const questionList = parseQuestionsJsonArray(questions);
    let modified = false;
    const blockedFormTypes = new Set();
    for (const question of questionList) {
        if (question.is_requir === undefined) {
            question.is_requir = true;
            modified = true;
        }
        if (atype === 7 &&
            question.q_type === 7 &&
            typeof question.q_subtype === "number") {
            const blockedType = FORM_BLOCKED_SUBTYPES.get(question.q_subtype);
            if (blockedType) {
                blockedFormTypes.add(blockedType);
            }
        }
    }
    if (blockedFormTypes.size > 0) {
        throw new Error(`表单类型问卷不支持以下题型：${Array.from(blockedFormTypes).join("、")}。` +
            "请改用单项填空、多项填空、多项简答题或多项文件题等支持题型。");
    }
    return modified ? JSON.stringify(questionList) : questions;
}
function validateJsonlQuestionTypesForCreate(jsonl, atype) {
    if (atype !== 7)
        return;
    const blockedFormTypes = new Set();
    for (const line of jsonl.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        let obj;
        try {
            obj = JSON.parse(trimmed);
        }
        catch {
            continue;
        }
        if (typeof obj.qtype !== "string")
            continue;
        const blockedType = FORM_BLOCKED_JSONL_QTYPES.get(obj.qtype);
        if (blockedType) {
            blockedFormTypes.add(blockedType);
        }
    }
    if (blockedFormTypes.size > 0) {
        throw new Error(`表单类型问卷不支持以下题型：${Array.from(blockedFormTypes).join("、")}。` +
            "请改用单项填空、多项填空、多项简答题或多项文件题等支持题型。");
    }
}
export function validateQuestionsJson(questions) {
    parseQuestionsJsonArray(questions);
}
export async function createSurvey(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.CREATE_SURVEY,
        title: input.title,
    };
    if (input.source_vid !== undefined) {
        params.source_vid = input.source_vid;
    }
    else {
        assertCreatableSurveyAtype(input.type);
        params.atype = input.type;
        params.desc = input.description;
        params.questions = normalizeQuestionsForCreate(input.questions, input.type);
    }
    params.publish = input.publish ?? false;
    if (input.creater !== undefined)
        params.creater = input.creater;
    if (input.compress_img !== undefined)
        params.compress_img = input.compress_img;
    if (input.is_string !== undefined)
        params.is_string = input.is_string;
    return callWjxApi(params, {
        credentials,
        fetchImpl,
        maxRetries: 0,
        timeoutMs: LONG_TIMEOUT_MS,
    });
}
export async function getSurvey(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.GET_SURVEY,
        vid: input.vid,
        get_questions: input.get_questions ?? true,
        get_items: input.get_items ?? true,
    };
    if (input.get_exts !== undefined)
        params.get_exts = input.get_exts;
    if (input.get_setting !== undefined)
        params.get_setting = input.get_setting;
    if (input.get_page_cut !== undefined)
        params.get_page_cut = input.get_page_cut;
    if (input.get_tags !== undefined)
        params.get_tags = input.get_tags;
    if (input.showtitle !== undefined)
        params.showtitle = input.showtitle;
    return callWjxApi(params, { credentials, fetchImpl });
}
export async function listSurveys(input = {}, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.LIST_SURVEYS,
        page_index: input.page_index ?? 1,
        page_size: input.page_size ?? 10,
    };
    if (input.status !== undefined)
        params.status = input.status;
    if (input.atype !== undefined)
        params.atype = input.atype;
    if (input.name_like !== undefined && input.name_like !== "")
        params.name_like = input.name_like;
    if (input.sort !== undefined)
        params.sort = input.sort;
    if (input.creater !== undefined)
        params.creater = input.creater;
    if (input.folder !== undefined)
        params.folder = input.folder;
    if (input.is_xingbiao !== undefined)
        params.is_xingbiao = input.is_xingbiao;
    if (input.query_all !== undefined)
        params.query_all = input.query_all;
    if (input.verify_status !== undefined)
        params.verify_status = input.verify_status;
    if (input.time_type !== undefined)
        params.time_type = input.time_type;
    if (input.begin_time !== undefined)
        params.begin_time = input.begin_time;
    if (input.end_time !== undefined)
        params.end_time = input.end_time;
    return callWjxApi(params, { credentials, fetchImpl });
}
export async function updateSurveyStatus(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxApi({
        action: Action.UPDATE_STATUS,
        vid: input.vid,
        state: input.state,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
export async function getSurveySettings(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxApi({
        action: Action.GET_SETTINGS,
        vid: input.vid,
        additional_setting: input.additional_setting ?? "[1000,1001,1002,1003,1004,1005,1006,1007]",
    }, { credentials, fetchImpl });
}
export async function updateSurveySettings(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.UPDATE_SETTINGS,
        vid: input.vid,
    };
    if (input.api_setting !== undefined)
        params.api_setting = input.api_setting;
    if (input.after_submit_setting !== undefined)
        params.after_submit_setting = input.after_submit_setting;
    if (input.msg_setting !== undefined)
        params.msg_setting = input.msg_setting;
    if (input.sojumpparm_setting !== undefined)
        params.sojumpparm_setting = input.sojumpparm_setting;
    if (input.time_setting !== undefined)
        params.time_setting = input.time_setting;
    return callWjxApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function deleteSurvey(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.DELETE_SURVEY,
        vid: input.vid,
        username: input.username,
    };
    if (input.completely_delete !== undefined)
        params.completely_delete = input.completely_delete;
    return callWjxApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
export async function getQuestionTags(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxApi({ action: Action.GET_TAGS, username: input.username }, { credentials, fetchImpl });
}
export async function getTagDetails(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxApi({ action: Action.GET_TAG_DETAILS, tag_id: input.tag_id }, { credentials, fetchImpl });
}
export async function clearRecycleBin(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const params = {
        action: Action.CLEAR_RECYCLE_BIN,
        username: input.username,
    };
    if (input.vid !== undefined)
        params.vid = input.vid;
    return callWjxApi(params, { credentials, fetchImpl, maxRetries: 0 });
}
/**
 * 通过 DSL 文本创建问卷（客户端解析 DSL 后调用 createSurvey API）。
 * 段落说明题会被自动过滤（API 不支持 q_type=2）。
 */
export async function createSurveyByText(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    // 解析 DSL 文本为结构化数据，然后通过 createSurvey API 创建
    const parsed = textToSurvey(input.text);
    const { questions: wireQuestions } = parsedQuestionsToWire(parsed.questions);
    const title = input.title ?? parsed.title;
    const description = parsed.description ?? "";
    return createSurvey({
        title,
        type: input.atype ?? 1,
        description,
        questions: JSON.stringify(wireQuestions),
        publish: input.publish,
        creater: input.creater,
    }, credentials, fetchImpl);
}
/**
 * 通过 JSONL 格式创建问卷（纯透传到服务端 action 1000106）。
 * 客户端仅做基本校验（非空、大小限制、BOM/CRLF 标准化），
 * 服务端自行解析 JSONL 并创建问卷。
 */
export async function createSurveyByJson(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    const jsonl = normalizeJsonl(input.jsonl.trim());
    if (!jsonl) {
        throw new Error("jsonl must not be empty");
    }
    if (jsonl.length > MAX_JSONL_SIZE) {
        throw new Error(`jsonl exceeds maximum size of ${MAX_JSONL_SIZE} bytes (${jsonl.length})`);
    }
    // 考试题型预处理：注入 isquiz="1"，并在用户未指定 atype 时推断为 6（考试）
    const { jsonl: examProcessed, hasExam } = preprocessExamJsonl(jsonl);
    // 默认必答预处理：与页面创建行为保持一致，为题目行注入 requir=true（未指定时）
    const requirInjected = injectDefaultRequir(examProcessed);
    const metadata = extractJsonlMetadata(requirInjected);
    const title = input.title ?? metadata.title;
    const description = metadata.description ?? "";
    // 标题合理性校验：空/占位符/过短/黑名单全部拦截，给出可执行修复建议
    validateSurveyTitle(title);
    // 题目数校验：JSONL 至少包含 1 道真实题目（排除元数据/分页/段落/知情同意书）
    validateSurveyHasQuestions(requirInjected);
    // atype 推断优先级：显式入参 > JSONL 元数据 atype > 考试题型 > 标题关键字 > 1（调查）
    const atype = input.atype ??
        metadata.atype ??
        (hasExam ? 6 : inferAtypeFromTitle(title) ?? 1);
    assertCreatableSurveyAtype(atype);
    validateJsonlQuestionTypesForCreate(requirInjected, atype);
    // 关键修复：服务端 action 1000106 实际只读 JSONL 内的 atype，忽略顶层字段。
    // 必须把最终 atype 注入「问卷基础信息」行，否则页面落库会一律变成 atype=1。
    const processedJsonl = injectAtypeIntoJsonl(requirInjected, atype);
    return callWjxApi({
        action: Action.CREATE_SURVEY_BY_JSON,
        title,
        atype,
        desc: description,
        surveydatajson: processedJsonl,
        publish: input.publish ?? false,
        ...(input.creater !== undefined ? { creater: input.creater } : {}),
    }, {
        credentials,
        fetchImpl,
        maxRetries: 0,
        timeoutMs: LONG_TIMEOUT_MS,
    });
}
export async function uploadFile(input, credentials = getWjxCredentials(), fetchImpl = fetch) {
    return callWjxApi({
        action: Action.UPLOAD_FILE,
        file_name: input.file_name,
        file: input.file,
    }, { credentials, fetchImpl, maxRetries: 0 });
}
//# sourceMappingURL=client.js.map