import { z } from "zod";
import { createSurveyByJson, createAiPage, updateAiPage, AI_PAGE_MAX_HTML_LENGTH, AI_PAGE_MAX_TITLE_LENGTH, AI_PAGE_PAGE_TYPES, CREATABLE_SURVEY_ATYPES, getSurvey, listSurveys, updateSurveyStatus, getSurveySettings, updateSurveySettings, deleteSurvey, getQuestionTags, getTagDetails, clearRecycleBin, uploadFile, surveyToText, MAX_JSONL_SIZE, extractJsonlQuestionTypeExpectations, compareJsonlQuestionTypes, filterJsonlVerificationQuestions, } from "./client.js";
import { buildPreviewUrl, getWjxBaseUrl, getWjxCredentials } from "wjx-api-sdk";
import { assertApiResponse, toolApiResult, toolResult, toolError } from "../../helpers.js";
import { QUESTION_TYPES } from "../../resources/survey-reference.js";
import { surveyIdentityMatches, surveyIdentityState } from "./identity.js";
import { parseNonNegativeCount, runVerifiedWrite, unknownVerification, } from "../../write-verification.js";
const SETTING_KEYS = [
    "api_setting",
    "after_submit_setting",
    "msg_setting",
    "sojumpparm_setting",
    "time_setting",
];
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : undefined;
}
function responseData(value) {
    return asRecord(asRecord(value)?.data);
}
function statusLabel(value) {
    const labels = {
        0: "draft",
        1: "published",
        2: "paused",
        3: "deleted",
        4: "hard-deleted",
        5: "reviewed",
    };
    const numeric = parseNonNegativeCount(value);
    if (numeric === undefined)
        return undefined;
    return Number.isInteger(numeric) && Object.hasOwn(labels, numeric) ? labels[numeric] : undefined;
}
// Public WJX deployments may return a respondent host different from the
// OpenAPI host (for example v.wjx.cn, tp.wjx.com, or ks.wjx.com). Keep this
// bounded to WJX-owned DNS families and require the configured protocol/port.
const OFFICIAL_RESPONDENT_HOST_SUFFIXES = [
    ".wjx.cn",
    ".wjx.com",
    ".wjx.top",
    ".sojump.cn",
    ".sojump.com",
];
function normalizeOrigin(value) {
    if (typeof value !== "string" || !value.trim())
        return undefined;
    try {
        const url = new URL(value.trim());
        if (url.protocol !== "http:" && url.protocol !== "https:")
            return undefined;
        return url.origin;
    }
    catch {
        return undefined;
    }
}
function isOfficialRespondentHost(hostname) {
    const host = hostname.trim().toLowerCase().replace(/\.$/, "");
    return OFFICIAL_RESPONDENT_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
}
function isAllowedRespondentOrigin(origin, configuredOrigins) {
    if (configuredOrigins.has(origin))
        return true;
    let candidate;
    try {
        candidate = new URL(origin);
    }
    catch {
        return false;
    }
    if (!isOfficialRespondentHost(candidate.hostname))
        return false;
    for (const configured of configuredOrigins) {
        try {
            const base = new URL(configured);
            if (base.protocol === candidate.protocol
                && base.port === candidate.port
                && isOfficialRespondentHost(base.hostname))
                return true;
        }
        catch {
            // Ignore malformed configured origins; exact-origin entries were checked
            // before this loop.
        }
    }
    return false;
}
function normalizeSid(value) {
    if (typeof value !== "string")
        return undefined;
    const sid = value.trim();
    return sid && !/^\d+$/.test(sid) ? sid : undefined;
}
function field(record, ...names) {
    for (const name of names) {
        if (record[name] !== undefined && record[name] !== null)
            return record[name];
    }
    return undefined;
}
function respondentUrl(value, origins, vid, relativeOrigin) {
    if (typeof value !== "string" || !value.trim())
        return undefined;
    let url;
    try {
        url = new URL(value.trim(), relativeOrigin ? `${relativeOrigin}/` : undefined);
    }
    catch {
        return undefined;
    }
    if (!isAllowedRespondentOrigin(url.origin, origins) || !/^\/(?:vm|m|jq)(?:\/|$)/i.test(url.pathname))
        return undefined;
    const segment = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    let publicId = segment.replace(/\.aspx$/i, "");
    try {
        publicId = decodeURIComponent(publicId);
    }
    catch {
        return undefined;
    }
    return publicId && !/^\d+$/.test(publicId) && publicId !== String(vid) ? url.toString() : undefined;
}
function resolveRespondentLink(data, vid, baseUrl) {
    if (!data)
        return { hadLinkFields: false };
    const configuredOrigins = new Set();
    const resolvedBaseUrl = getWjxBaseUrl(baseUrl);
    const baseOrigin = normalizeOrigin(resolvedBaseUrl);
    if (baseOrigin)
        configuredOrigins.add(baseOrigin);
    const activityOrigin = normalizeOrigin(field(data, "activity_domain", "activityDomain", "respondent_domain"));
    const relativeOrigin = activityOrigin && isAllowedRespondentOrigin(activityOrigin, configuredOrigins)
        ? activityOrigin
        : undefined;
    const fullFill = field(data, "fill_url", "fillUrl", "respondent_url", "respondentUrl");
    const paths = [
        field(data, "pc_path", "pcPath"),
        field(data, "mobile_path", "mobilePath"),
        field(data, "fill_path", "fillPath"),
    ];
    let fillUrl = respondentUrl(fullFill, configuredOrigins, vid, relativeOrigin);
    if (!fillUrl) {
        for (const path of paths) {
            fillUrl = respondentUrl(path, configuredOrigins, vid, relativeOrigin);
            if (fillUrl)
                break;
        }
    }
    const sid = normalizeSid(field(data, "sid", "short_id", "shortId"));
    const hadLinkFields = fullFill !== undefined || paths.some((value) => value !== undefined);
    if (!fillUrl && sid && !hadLinkFields) {
        try {
            fillUrl = buildPreviewUrl({ sid, vid, allowVidFallback: false }, resolvedBaseUrl);
        }
        catch {
            // Leave the link unverified; the caller reports an actionable warning.
        }
    }
    return {
        ...(fillUrl ? { fillUrl } : {}),
        ...(sid ? { sid } : {}),
        hadLinkFields,
    };
}
function activityRecords(data) {
    if (!data)
        return [];
    const value = field(data, "activitys", "activities", "surveys");
    if (Array.isArray(value))
        return value.filter((item) => Boolean(asRecord(item)));
    const map = asRecord(value);
    return map ? Object.values(map).filter((item) => Boolean(asRecord(item))) : [];
}
function recordMatchesVid(record, vid) {
    const candidate = field(record, "vid", "activity", "id");
    return candidate !== undefined && String(candidate).trim() === String(vid);
}
async function findListRecord(vid) {
    let seen = 0;
    for (let page = 1; page <= 100; page += 1) {
        const result = await listSurveys({ page_index: page, page_size: 50 });
        assertApiResponse(result);
        if (result.result !== true)
            return undefined;
        const data = responseData(result);
        const records = activityRecords(data);
        const match = records.find((record) => recordMatchesVid(record, vid));
        if (match)
            return match;
        seen += records.length;
        const total = parseNonNegativeCount(field(data ?? {}, "total_count", "totalCount"));
        if (!records.length || (total !== undefined && total > 0 && seen >= total) || records.length < 50)
            break;
    }
    return undefined;
}
function currentBaseUrl() {
    try {
        return getWjxCredentials().baseUrl;
    }
    catch {
        return undefined;
    }
}
function surveyReadOrThrow(vid) {
    return getSurvey({ vid }).then((result) => {
        assertApiResponse(result);
        if (result.result !== true)
            throw new Error(result.errormsg || `问卷 ${vid} 读取失败`);
        if (!surveyIdentityMatches(responseData(result), vid)) {
            throw new Error(`问卷 ${vid} 读回身份不匹配或缺少可验证编号，已停止写入`);
        }
        return result;
    });
}
function settingsPayload(value) {
    const data = responseData(value);
    if (!data)
        return undefined;
    return asRecord(data.settings) ?? data;
}
function parseSettingObject(value) {
    if (typeof value === "string") {
        try {
            return asRecord(JSON.parse(value));
        }
        catch {
            return undefined;
        }
    }
    return asRecord(value);
}
function deepMerge(base, patch) {
    const merged = { ...base };
    for (const [key, value] of Object.entries(patch)) {
        const existing = asRecord(merged[key]);
        const next = asRecord(value);
        merged[key] = existing && next ? deepMerge(existing, next) : value;
    }
    return merged;
}
function settingKeys(args) {
    return SETTING_KEYS.filter((key) => args[key] !== undefined);
}
function createQuestionCount(jsonl) {
    if (typeof jsonl !== "string")
        return undefined;
    try {
        // Keep the count aligned with the SDK's verification helper: metadata and
        // page/paragraph/consent scaffolding are excluded from real-question
        // evidence, so the count and qtype positions cannot drift apart.
        return extractJsonlQuestionTypeExpectations(jsonl).length;
    }
    catch {
        return undefined;
    }
}
function createTitle(jsonl, explicit) {
    if (typeof explicit === "string" && explicit.trim())
        return explicit.trim();
    if (typeof jsonl !== "string")
        return undefined;
    try {
        const first = jsonl.split(/\r?\n/).find(Boolean);
        const row = first ? asRecord(JSON.parse(first)) : undefined;
        return typeof row?.title === "string" && row.title.trim() ? row.title.trim() : undefined;
    }
    catch {
        return undefined;
    }
}
function recycleBinCount(value) {
    const data = asRecord(value);
    if (!data)
        return { known: false };
    for (const key of ["total_count", "totalCount", "count"]) {
        const raw = data[key];
        const count = parseNonNegativeCount(raw);
        if (count !== undefined)
            return { known: true, count };
    }
    for (const key of ["activitys", "activities", "surveys"]) {
        const value = data[key];
        if (Array.isArray(value))
            return { known: true, count: value.length };
        const object = asRecord(value);
        if (object)
            return { known: true, count: Object.keys(object).length };
    }
    return { known: false };
}
function verificationFailure(message, flags = {}, required = ["read-after-write"]) {
    return unknownVerification(message, flags, required);
}
// WJX may expose a deletion in stages. Poll only the read endpoint and stop
// after a bounded settling window so an Agent never replays the delete write.
// Public API deletion is eventually consistent; allow a bounded settling
// window long enough for status=4 to become visible without replaying delete.
const DELETE_VERIFY_DELAYS_MS = [100, 200, 400, 800, 1_000, 1_000, 1_000, 2_000, 2_000];
const DELETE_VERIFY_MAX_ATTEMPTS = DELETE_VERIFY_DELAYS_MS.length + 1;
function deleteStatusCode(value) {
    const numeric = parseNonNegativeCount(value);
    if (numeric !== undefined)
        return numeric;
    const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/[\s_]+/g, "-") : "";
    if (normalized === "deleted")
        return 3;
    if (normalized === "hard-deleted")
        return 4;
    return undefined;
}
function deleteStatusMatches(value, completely) {
    const numeric = deleteStatusCode(value);
    if (numeric === undefined)
        return false;
    return completely ? numeric === 4 : numeric === 3;
}
function waitForDeleteVerification(delayMs) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
}
async function verifyDeletedSurvey(vid, completely, phase) {
    let last = verificationFailure(completely ? "问卷仍可读或未达到彻底删除状态" : "问卷仍可读，删除状态未得到确认", { link: true }, ["survey-delete-status"]);
    let attempts = 0;
    for (let attempt = 1; attempt <= DELETE_VERIFY_MAX_ATTEMPTS; attempt += 1) {
        attempts = attempt;
        try {
            const readBack = await getSurvey({ vid });
            if (readBack.result === false) {
                const notFound = /not[ -]?found|不存在|找不到/i.test(readBack.errormsg || "");
                // Not-found cannot establish either deletion state. Retrying the same
                // response cannot add evidence, so return unknown immediately.
                last = verificationFailure(notFound
                    ? completely
                        ? "问卷读回不存在，但无法证明已达到彻底删除状态（status=4）"
                        : "问卷读回不存在，但无法证明已进入回收站状态（status=3）"
                    : (readBack.errormsg || "删除后的问卷状态无法确认"), { link: true }, [completely ? "survey-status-4" : "survey-status-3"]);
                if (notFound)
                    break;
            }
            else {
                const data = responseData(readBack);
                const actual = statusLabel(data?.status);
                const explicitStatus = typeof data?.status === "string"
                    ? data.status.trim().toLowerCase().replace(/[\s_]+/g, "-")
                    : undefined;
                const structure = surveyIdentityMatches(data, vid);
                const status = deleteStatusMatches(data?.status, completely);
                const verified = structure && status;
                last = {
                    ...((actual || explicitStatus) ? { status: actual ?? explicitStatus } : {}),
                    outcome: verified ? "verified" : "unknown",
                    verification: { structure, status, count: false, link: true },
                    warnings: verified ? [] : [
                        ...(structure ? [] : ["删除状态读回的问卷编号与请求不一致或缺少可验证身份"]),
                        ...(!status ? [completely ? "问卷仍可读或未达到彻底删除状态" : "问卷仍可读，删除状态未得到确认"] : []),
                    ],
                    ...(verified ? {} : { verificationRequired: ["survey-delete-status"] }),
                    attempts: attempt,
                };
                if (verified)
                    return last;
            }
        }
        catch (error) {
            last = verificationFailure(`删除后的问卷读取失败：${error instanceof Error ? error.message : String(error)}`, { link: true }, ["survey-delete-status"]);
        }
        if (attempt < DELETE_VERIFY_MAX_ATTEMPTS) {
            await waitForDeleteVerification(DELETE_VERIFY_DELAYS_MS[attempt - 1]);
        }
    }
    if (phase === "ambiguous")
        last.warnings = ["写入传输结果不明确，已完成有界删除状态轮询", ...last.warnings];
    last.attempts = attempts;
    return last;
}
export function registerSurveyTools(server) {
    server.registerTool("create_ai_page", {
        title: "创建 AI 主页",
        description: "调用 OpenAPI A1000107 创建一个独立的纯展示 AI 主页。只调用本工具，不要额外创建或关联表单、问卷。html_content（或兼容字段 html）必填。page_type=2 时必须生成逐页 PPT：每张幻灯片占一个固定画布并逐页切换，禁止把全部内容做成单个纵向长页面。",
        inputSchema: {
            html_content: z.string().max(AI_PAGE_MAX_HTML_LENGTH).refine((value) => value.trim().length > 0, "HTML 内容不能为空").optional().describe(`AI 主页 HTML 内容，最长 ${AI_PAGE_MAX_HTML_LENGTH} 字符`),
            html: z.string().max(AI_PAGE_MAX_HTML_LENGTH).refine((value) => value.trim().length > 0, "HTML 内容不能为空").optional().describe("html_content 的兼容字段"),
            title: z.string().max(AI_PAGE_MAX_TITLE_LENGTH).optional().describe("AI 主页标题，不能包含问卷星"),
            page_type: z.number().int().refine((value) => AI_PAGE_PAGE_TYPES.includes(value)).optional().describe("页面类型：0=网页, 1=海报, 2=PPT"),
            publish: z.boolean().optional().describe("是否创建后立即发布"),
            creater: z.string().optional().describe("创建者子账号用户名"),
        },
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true, title: "创建 AI 主页" },
    }, async (args) => {
        try {
            return toolApiResult(await createAiPage(args));
        }
        catch (error) {
            return toolError(error);
        }
    });
    server.registerTool("update_ai_page", {
        title: "更新 AI 主页",
        description: "调用 OpenAPI A1000108 原位更新 AI 主页。先用 get_survey 读取目标的 html_content 和 page_type，再基于完整原 HTML 做修改；草稿也能读取，不要访问公开页或重做整页。vid 必须是传统数字编号，html_content（或兼容字段 html）必填。页面类型不可修改；若用户要求在网页、海报、PPT之间转换，直接说明不支持，不得创建替代主页，也不得删除原主页。",
        inputSchema: {
            vid: z.union([z.number().int().positive(), z.string().regex(/^(?:0*[1-9]\d*)$/)]).describe("传统数字 AI 主页 vid，不接受 sid"),
            html_content: z.string().max(AI_PAGE_MAX_HTML_LENGTH).refine((value) => value.trim().length > 0, "HTML 内容不能为空").optional().describe(`AI 主页 HTML 内容，最长 ${AI_PAGE_MAX_HTML_LENGTH} 字符`),
            html: z.string().max(AI_PAGE_MAX_HTML_LENGTH).refine((value) => value.trim().length > 0, "HTML 内容不能为空").optional().describe("html_content 的兼容字段"),
            title: z.string().max(AI_PAGE_MAX_TITLE_LENGTH).optional().describe("AI 主页标题，不能包含问卷星"),
        },
        annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: true, title: "更新 AI 主页" },
    }, async (args) => {
        try {
            return toolApiResult(await updateAiPage(args));
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── get_survey ───────────────────────────────────────────────────
    server.registerTool("get_survey", {
        title: "获取问卷内容",
        description: "根据问卷编号获取问卷详情，包括题目和选项信息。AI 主页（atype=12）会直接返回 html_content 和固定的 page_type，草稿无需访问公开页也可读取。支持 format 参数选择返回格式：json（结构化）、dsl（人类可读文本）、both（两者都返回）。",
        inputSchema: {
            vid: z.number().int().positive().describe("问卷编号"),
            format: z
                .enum(["json", "dsl", "both"])
                .optional()
                .default("json")
                .describe("返回格式：json=结构化 JSON（默认），dsl=人类可读 DSL 文本，both=两者都返回"),
            get_questions: z
                .boolean()
                .optional()
                .default(true)
                .describe("是否获取题目信息"),
            get_items: z
                .boolean()
                .optional()
                .default(true)
                .describe("是否获取选项信息"),
            get_exts: z
                .boolean()
                .optional()
                .describe("是否获取问答选项列表"),
            get_setting: z
                .boolean()
                .optional()
                .describe("是否获取题目设置信息"),
            get_page_cut: z
                .boolean()
                .optional()
                .describe("是否获取分页信息"),
            get_tags: z
                .boolean()
                .optional()
                .describe("是否获取绑定的题目标签信息"),
            showtitle: z
                .boolean()
                .optional()
                .describe("是否返回问卷标题"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "获取问卷内容",
        },
    }, async (args) => {
        try {
            const result = await getSurvey({
                vid: args.vid,
                get_questions: args.get_questions,
                get_items: args.get_items,
                get_exts: args.get_exts,
                get_setting: args.get_setting,
                get_page_cut: args.get_page_cut,
                get_tags: args.get_tags,
                showtitle: args.showtitle,
            });
            assertApiResponse(result);
            if (result.result === false) {
                return toolApiResult(result);
            }
            const fmt = args.format ?? "json";
            if (fmt === "dsl") {
                const dsl = surveyToText(result.data);
                return toolResult({ dsl }, false);
            }
            if (fmt === "both") {
                const dsl = surveyToText(result.data);
                return toolResult({ ...result, dsl }, false);
            }
            // default: json
            return toolApiResult(result);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── list_surveys ─────────────────────────────────────────────────
    server.registerTool("list_surveys", {
        title: "获取问卷列表",
        description: "分页获取账户下的问卷列表，可按状态、类型、名称筛选。",
        inputSchema: {
            page_index: z
                .number()
                .int()
                .positive()
                .optional()
                .default(1)
                .describe("页码，从1开始"),
            page_size: z
                .number()
                .int()
                .min(1)
                .max(300)
                .optional()
                .default(10)
                .describe("每页数量（1-300）"),
            status: z
                .number()
                .int()
                .optional()
                .describe("问卷状态筛选"),
            atype: z
                .number()
                .int()
                .optional()
                .describe("问卷类型筛选：1=调查, 2=测评, 3=投票, 4=360度评估, 5=360评估无测评关系, 6=考试, 7=表单, 8=用户体系, 9=教学评估, 10=量表, 11=民主评议"),
            name_like: z
                .string()
                .max(10)
                .optional()
                .describe("按名称模糊搜索（最长10字符）"),
            sort: z
                .number()
                .int()
                .min(0)
                .max(5)
                .optional()
                .describe("排序：0=ID升序, 1=ID降序, 2=开始时间升序, 3=开始时间降序, 4=创建时间升序, 5=创建时间降序"),
            creater: z
                .string()
                .optional()
                .describe("指定子账号用户名筛选"),
            folder: z
                .string()
                .optional()
                .describe("文件夹名称筛选"),
            is_xingbiao: z
                .boolean()
                .optional()
                .describe("是否只获取星标问卷"),
            query_all: z
                .boolean()
                .optional()
                .describe("是否获取企业所有问卷（需管理员权限）"),
            verify_status: z
                .number()
                .int()
                .optional()
                .describe("审核状态筛选：1=已通过, 2=审核中, 3=未通过, 4=待实名"),
            time_type: z
                .number()
                .int()
                .min(0)
                .max(2)
                .optional()
                .describe("时间查询类型：0=不按时间查询（默认）, 1=按问卷开始时间, 2=按问卷创建时间"),
            begin_time: z
                .number()
                .optional()
                .describe("时间范围起始（毫秒时间戳）"),
            end_time: z
                .number()
                .optional()
                .describe("时间范围结束（毫秒时间戳）"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "获取问卷列表",
        },
    }, async (args) => {
        try {
            const result = await listSurveys({
                page_index: args.page_index,
                page_size: args.page_size,
                status: args.status,
                atype: args.atype,
                name_like: args.name_like,
                sort: args.sort,
                creater: args.creater,
                folder: args.folder,
                is_xingbiao: args.is_xingbiao,
                query_all: args.query_all,
                verify_status: args.verify_status,
                time_type: args.time_type,
                begin_time: args.begin_time,
                end_time: args.end_time,
            });
            return toolApiResult(result);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── update_survey_status ─────────────────────────────────────────
    server.registerTool("update_survey_status", {
        title: "修改问卷状态",
        description: "修改问卷的发布状态：发布(1)、暂停(2)、删除(3，进入回收站，可恢复)。" +
            "【状态转换规则】未发布(0)→已发布(1)；已发布(1)→已暂停(2)或已删除(3，回收站，可恢复)；已暂停(2)→已发布(1)或已删除(3，回收站，可恢复)。彻底删除(4，不可恢复)只能通过 delete_survey(completely_delete=true) 或 clear_recycle_bin 完成。不可跳过中间状态（如从0直接到2），否则 API 会返回错误。",
        inputSchema: {
            vid: z.number().int().positive().describe("问卷编号"),
            state: z
                .number()
                .int()
                .min(1)
                .max(3)
                .describe("目标状态：1=发布, 2=暂停, 3=删除并进入回收站（可恢复）"),
        },
        annotations: {
            destructiveHint: true,
            // Status changes are unsafe in the SDK (publish/pause/delete can
            // trigger server-side transitions); do not advertise replay safety.
            idempotentHint: false,
            openWorldHint: true,
            title: "修改问卷状态",
        },
    }, async (args) => {
        try {
            return runVerifiedWrite({
                operation: "update_survey_status",
                preRead: () => surveyReadOrThrow(args.vid),
                write: () => updateSurveyStatus({ vid: args.vid, state: args.state }),
                verify: async ({ phase, preRead }) => {
                    let readBack;
                    try {
                        readBack = await getSurvey({ vid: args.vid });
                    }
                    catch (error) {
                        return verificationFailure(`问卷状态读回失败：${error instanceof Error ? error.message : String(error)}`, { link: true });
                    }
                    if (readBack.result !== true) {
                        return verificationFailure(readBack.errormsg || "问卷状态读回失败", { link: true });
                    }
                    const data = responseData(readBack);
                    const actual = statusLabel(data?.status);
                    const expected = args.state === 1 ? "published" : args.state === 2 ? "paused" : "deleted";
                    const structure = surveyIdentityMatches(data, args.vid);
                    const status = actual === expected;
                    const warnings = [
                        ...(structure ? [] : ["问卷状态读回的问卷编号与请求不一致或缺少可验证身份"]),
                        ...(!status ? [`问卷状态读回为 ${actual ?? "unknown"}，预期为 ${expected}`] : []),
                    ];
                    return {
                        ...(actual ? { status: actual } : {}),
                        outcome: structure && status ? "verified" : "unknown",
                        verification: { structure, status, count: false, link: true },
                        warnings: phase === "ambiguous"
                            ? ["写入传输结果不明确，已通过状态读回检查", ...warnings]
                            : warnings,
                        ...(structure && status ? {} : { verificationRequired: ["survey-status"] }),
                    };
                },
            });
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── get_survey_settings ──────────────────────────────────────────
    server.registerTool("get_survey_settings", {
        title: "获取问卷设置",
        description: "获取问卷的详细设置，包括时间设置、提交后跳转、考试设置、维度、奖品、数据推送等。",
        inputSchema: {
            vid: z.number().int().positive().describe("问卷编号"),
            additional_setting: z
                .string()
                .optional()
                .default("[1000,1001,1002,1003,1004,1005,1006,1007]")
                .describe("要获取的设置类别 JSON 数组字符串。默认获取全部：1000=时间设置, 1001=提交后设置, 1002=成绩单设置, 1003=维度设置, 1004=自定义参数设置, 1005=奖品设置, 1006=数据推送设置, 1007=问卷文件夹"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "获取问卷设置",
        },
    }, async (args) => {
        try {
            const result = await getSurveySettings({ vid: args.vid, additional_setting: args.additional_setting });
            return toolApiResult(result);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── update_survey_settings ───────────────────────────────────────
    server.registerTool("update_survey_settings", {
        title: "修改问卷设置",
        description: "修改问卷的设置，包括 API 限制、提交后跳转、数据推送、自定义参数、时间设置等。每个设置项为 JSON 字符串。",
        inputSchema: {
            vid: z.number().int().positive().describe("问卷编号"),
            api_setting: z.string().optional().describe("API参与次数限制设置 JSON，格式：{\"limit_type\":<int>,\"passing_score\":<int>}。limit_type 值: 0=不限, 1=只许填写一次, -1=每天填写一次, -9999=及格后不允许再作答。passing_score: 及格分数（默认60），仅 limit_type=-9999 时生效"),
            after_submit_setting: z.string().optional().describe("提交后设置 JSON。跳转到指定页面：{\"go_redirect\":true,\"redirect_url\":\"https://example.com\",\"redirect_words\":\"即将跳转\"}。显示感谢信息：{\"show_thanks\":true,\"thank_words\":\"感谢参与\"}。注意：go_redirect 和 show_thanks 不能同时为 true"),
            msg_setting: z.string().optional().describe("数据推送设置 JSON，格式：{\"post_url\":\"https://example.com/webhook\",\"quick_post\":true,\"retry\":true}。【重要】此接口为全量覆盖，必须先通过 get_survey_settings（additional_setting 含 1006）获取当前完整推送配置，在现有配置基础上修改后再提交完整 JSON，否则未传字段（如 post_url）将被清空"),
            sojumpparm_setting: z.string().optional().describe("自定义链接参数设置 JSON，格式示例：{\"params\":[{\"name\":\"source\",\"type\":0}]} (注意：此接口仅修改当前问卷配置，不支持「应用到全局」)"),
            time_setting: z.string().optional().describe("时间设置 JSON，格式：{\"begin_time\":\"2026-04-01 00:00\",\"end_time\":\"2026-12-31 23:59\",\"max_answer_seconds\":3600,\"max_no_operat_seconds\":300,\"max_tab_screen_count\":3}。max_answer_seconds=最长作答秒数, max_no_operat_seconds=最长无操作自动交卷秒数, max_tab_screen_count=允许切屏最大次数。注意：OpenAPI 不支持设置最短作答时间"),
        },
        annotations: {
            destructiveHint: true,
            // The API replaces the supplied settings and the SDK deliberately
            // disables retries; hosts must not automatically replay this call.
            idempotentHint: false,
            openWorldHint: true,
            title: "修改问卷设置",
        },
    }, async (args) => {
        try {
            const requested = settingKeys(args);
            if (requested.length === 0) {
                return toolResult({ error: "至少需要提供一个设置项" }, true);
            }
            // 在 handler 中验证 JSON 格式（避免 Zod .refine() 导致 MCP 挂起）
            for (const key of requested) {
                const value = args[key];
                if (typeof value !== "string")
                    throw new Error(`${key} 必须是合法的 JSON 字符串`);
                try {
                    JSON.parse(value);
                }
                catch {
                    throw new Error(`${key} 必须是合法的 JSON 字符串`);
                }
            }
            let prepared = { vid: args.vid };
            return runVerifiedWrite({
                operation: "update_survey_settings",
                preRead: async () => {
                    const result = await getSurveySettings({ vid: args.vid });
                    assertApiResponse(result);
                    if (result.result !== true)
                        throw new Error(result.errormsg || `问卷 ${args.vid} 设置读取失败`);
                    if (surveyIdentityState(responseData(result), args.vid) === "mismatch") {
                        throw new Error(`问卷 ${args.vid} 设置读回身份不匹配，已停止写入`);
                    }
                    return result;
                },
                write: async (before) => {
                    const current = settingsPayload(before);
                    prepared = { vid: args.vid };
                    for (const key of requested) {
                        const patch = parseSettingObject(args[key]);
                        if (!patch)
                            throw new Error(`${key} 必须是 JSON 对象`);
                        const existing = parseSettingObject(current?.[key]);
                        prepared[key] = JSON.stringify(existing ? deepMerge(existing, patch) : patch);
                    }
                    return updateSurveySettings(prepared);
                },
                verify: async ({ phase, preRead }) => {
                    let after;
                    try {
                        after = await getSurveySettings({ vid: args.vid });
                    }
                    catch (error) {
                        return verificationFailure(`设置读回失败：${error instanceof Error ? error.message : String(error)}`, { link: true }, ["survey-settings"]);
                    }
                    if (after.result !== true) {
                        return verificationFailure(after.errormsg || "设置读回失败", { link: true }, ["survey-settings"]);
                    }
                    const afterData = settingsPayload(after);
                    const beforeData = settingsPayload(preRead);
                    const identityState = surveyIdentityState(responseData(after), args.vid);
                    const verifiedFields = [];
                    const mismatchedFields = [];
                    const missingAfter = [];
                    for (const key of requested) {
                        const expected = parseSettingObject(prepared[key]);
                        const actual = parseSettingObject(afterData?.[key]);
                        if (!actual)
                            missingAfter.push(key);
                        else if (expected && JSON.stringify(actual) === JSON.stringify(expected))
                            verifiedFields.push(key);
                        else
                            mismatchedFields.push(key);
                    }
                    const warnings = [];
                    const missingBefore = requested.filter((key) => parseSettingObject(beforeData?.[key]) === undefined);
                    if (missingBefore.length)
                        warnings.push(`写入前读回缺少字段，无法确认未修改设置是否保留：${missingBefore.join(", ")}`);
                    if (mismatchedFields.length)
                        warnings.push(`设置读回与请求不一致：${mismatchedFields.join(", ")}`);
                    if (missingAfter.length)
                        warnings.push(`设置读回缺少字段：${missingAfter.join(", ")}`);
                    if (identityState === "mismatch")
                        warnings.push("设置读回的问卷编号与请求不一致");
                    const identityValid = identityState !== "mismatch";
                    const structure = identityValid && missingAfter.length === 0;
                    const status = identityValid && structure && mismatchedFields.length === 0 && verifiedFields.length === requested.length && missingBefore.length === 0;
                    if (phase === "ambiguous")
                        warnings.unshift("写入传输结果不明确，已尝试设置读回");
                    return {
                        outcome: status ? "verified" : "unknown",
                        verification: { structure, status, count: false, link: true },
                        verifiedFields,
                        warnings,
                        ...(status ? {} : { verificationRequired: ["survey-settings"] }),
                    };
                },
            });
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── delete_survey ────────────────────────────────────────────────
    server.registerTool("delete_survey", {
        title: "删除问卷",
        description: "删除问卷。普通删除进入回收站（status=3，可恢复）；设置 completely_delete=true 才会彻底删除（status=4，不可恢复）。请谨慎使用。",
        inputSchema: {
            vid: z.number().int().positive().describe("问卷编号"),
            username: z.string().min(1).describe("用户名（主账户/系统管理员/问卷创建者子账号）"),
            completely_delete: z.boolean().optional().describe("是否彻底删除（status=4，不可恢复；不传则进入回收站 status=3，可恢复）"),
        },
        annotations: {
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
            title: "删除问卷",
        },
    }, async (args) => {
        try {
            return runVerifiedWrite({
                operation: "delete_survey",
                preRead: () => surveyReadOrThrow(args.vid),
                write: () => deleteSurvey({
                    vid: args.vid,
                    username: args.username,
                    completely_delete: args.completely_delete,
                }),
                verify: ({ phase }) => verifyDeletedSurvey(args.vid, args.completely_delete === true, phase),
            });
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── get_question_tags ────────────────────────────────────────────
    server.registerTool("get_question_tags", {
        title: "获取题目标签",
        description: "获取指定用户所在企业的所有题目标签列表。",
        inputSchema: {
            username: z.string().min(1).describe("用户名"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "获取题目标签",
        },
    }, async (args) => {
        try {
            const result = await getQuestionTags({ username: args.username });
            return toolApiResult(result);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── get_tag_details ──────────────────────────────────────────────
    server.registerTool("get_tag_details", {
        title: "获取题目标签详情",
        description: "根据标签 ID 获取标签下的题目详情列表，包括关联的问卷、题目类型和标签名称。",
        inputSchema: {
            tag_id: z.number().int().positive().describe("标签 ID"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "获取题目标签详情",
        },
    }, async (args) => {
        try {
            const result = await getTagDetails({ tag_id: args.tag_id });
            // Enrich q_type with human-readable description
            assertApiResponse(result);
            if (result.result === true && Array.isArray(result.data)) {
                for (const item of result.data) {
                    const qType = Number(item.q_type);
                    if (!isNaN(qType) && QUESTION_TYPES[qType]) {
                        item.q_type_name = QUESTION_TYPES[qType].name;
                    }
                }
            }
            return toolApiResult(result);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── upload_file ─────────────────────────────────────────────────
    server.registerTool("upload_file", {
        title: "上传文件",
        description: "上传图片文件用于问卷。支持 png/jpg/gif/jpeg/bmp/webp 格式，文件以 Base64 编码传入，最大约 4MB。",
        inputSchema: {
            file_name: z.string().min(1).describe("文件名，须含扩展名（.png/.jpg/.gif/.jpeg/.bmp/.webp）"),
            file: z.string().min(1).describe("Base64 编码的文件内容"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
            title: "上传文件",
        },
    }, async (args) => {
        try {
            const result = await uploadFile({
                file_name: args.file_name,
                file: args.file,
            });
            return toolApiResult(result);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── clear_recycle_bin ────────────────────────────────────────────
    server.registerTool("clear_recycle_bin", {
        title: "清空回收站",
        description: "清空回收站中的问卷。若指定 vid 则使用彻底删除动作并只处理该问卷，否则调用批量回收站清理。此操作不可逆！",
        inputSchema: {
            username: z.string().min(1).describe("用户名（只能清空该用户创建的问卷）"),
            vid: z.number().int().positive().optional().describe("问卷编号（指定则仅删除该问卷，否则清空回收站）"),
        },
        annotations: {
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
            title: "清空回收站",
        },
    }, async (args) => {
        try {
            return runVerifiedWrite({
                operation: "clear_recycle_bin",
                preRead: async () => {
                    if (args.vid !== undefined) {
                        const result = await surveyReadOrThrow(args.vid);
                        const data = responseData(result);
                        if (deleteStatusCode(data?.status) !== 3) {
                            throw new Error(`问卷 ${args.vid} 当前不在回收站（status=3），已停止清理`);
                        }
                        return { kind: "survey", result };
                    }
                    const result = await listSurveys({ status: 3, page_index: 1, page_size: 50 });
                    assertApiResponse(result);
                    if (result.result !== true)
                        throw new Error(result.errormsg || "回收站读取失败");
                    if (!recycleBinCount(result.data).known)
                        throw new Error("清空前无法读取回收站总数，已停止清理");
                    return { kind: "bin", result };
                },
                // The public 1000302 action acknowledges a scoped `vid` but leaves
                // the item in status=3. A scoped cleanup therefore uses the same
                // hard-delete action that is proven to produce status=4; the bulk
                // form keeps the dedicated recycle-bin endpoint.
                write: () => args.vid === undefined
                    ? clearRecycleBin({ username: args.username })
                    : deleteSurvey({ vid: args.vid, username: args.username, completely_delete: true }),
                verify: async ({ phase }) => {
                    if (args.vid !== undefined) {
                        // Scoped cleanup uses the hard-delete endpoint and shares the
                        // bounded read-only poll with delete_survey. The public service
                        // can expose status=3 briefly after acknowledging the write.
                        return verifyDeletedSurvey(args.vid, true, phase);
                    }
                    let result;
                    try {
                        result = await listSurveys({ status: 3, page_index: 1, page_size: 50 });
                    }
                    catch (error) {
                        return verificationFailure(`回收站列表读回失败：${error instanceof Error ? error.message : String(error)}`, { link: true }, ["recycle-bin-count"]);
                    }
                    if (result.result !== true)
                        return verificationFailure(result.errormsg || "回收站列表读回失败", { link: true }, ["recycle-bin-count"]);
                    const count = recycleBinCount(result.data);
                    const verified = count.known && count.count === 0;
                    return {
                        ...(count.known ? { remaining: count.count } : {}),
                        outcome: verified ? "verified" : "unknown",
                        verification: { structure: count.known, status: verified, count: count.known, link: true },
                        warnings: verified ? [] : ["回收站读回缺少可证明为空的计数，清理结果未知"],
                        ...(verified ? {} : { verificationRequired: ["recycle-bin-count"] }),
                    };
                },
            });
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── create_survey_by_json ───────────────────────────────────────
    server.registerTool("create_survey_by_json", {
        title: "用 JSON 创建问卷",
        description: "（推荐，支持 70+ 题型）通过 JSONL 格式创建问卷。每行一个 JSON 对象，首行为 qtype='问卷基础信息' 的元数据。" +
            "支持 70+ 种可创建题型（普通调查、投票、专业调查模型、考试、表单），远多于 DSL 文本格式；矩阵数值题、VlookUp问卷关联、多项文件题、多项简答题、当前语音仅支持读取或 Web 编辑器配置，创建前会拒绝。" +
            "【核心字段】qtype（题型名称）、title（标题，只写题目正文，不写题目类型）、select（选项数组）、rowtitle（行标题或表格字段名）、requir（是否必填；缺省时 SDK 注入 true）。" +
            "【必答规则】默认所有题型都是必答题，包括单项填空、简答题、意见建议题、开放题；只有用户明确指定某个题号/题目/字段为选填时，才给该题传 requir=false。" +
            "【专业模型】支持 BWS/MaxDiff(mdattr+pertaskcount+tasklength)、联合分析(columntitle)、品牌漏斗(brands)、Kano模型、SUS模型、PSM模型等。" +
            "【考试题型】支持 correctselect（正确答案）、quizscore（分值）、answeranalysis（答案解析）。" +
            "【关联逻辑】支持 relation（显示条件）、referselect（引用前题选项）。" +
            "【硬性校验 — 不满足会被 SDK 拒绝】1) 标题不得为空、占位符（??? / 无标题 / TODO / xxx 等）或少于 2 字；2) JSONL 必须包含至少 1 道真实题目（_meta/分页栏/段落说明/知情同意书不计入）。" +
            "【多项填空必看】多项填空 qtype='多项填空'，子填空位数量由 title 中的 {_} 占位符数量决定，例如 title='电话 {_}，邮箱 {_}，微信 {_}' 会生成 3 个空位；**禁止用 rowtitle 数组**（多项填空不支持该字段，服务端会忽略并只生成 1 个空位）。考试多项填空同理；考试完形填空不在当前 JSONL 创建支持集合中。" +
            "【表格类题型 706-710】生成 JSONL 时必须优先使用标准格式：" +
            "表格数值/表格填空使用 rowtitle；表格下拉框使用 rowtitle+selects；表格组合使用 rowtitle+types+selects；自增表格使用 rowtitle+columntitle+selects（一行模板），可选 min_rows/max_rows 设置行数边界，不要用 minvalue/maxvalue 代替。" +
            "多项文件题(711)和多项简答题(712)只能读取或在 Web 编辑器配置，当前创建接口会拒绝；需要多字段采集时请使用普通文件上传/简答题或表格题。" +
            "【投票题】投票单选/投票多选使用 qtype='投票单选'/'投票多选' + select，并在调用工具时显式传 atype=3。" +
            "输入示例（JSONL）：\n" +
            '{"qtype":"问卷基础信息","title":"客户满意度调查","introduction":"请认真填写"}\n' +
            '{"qtype":"单选","title":"您的性别","select":["男","女"]}\n' +
            '{"qtype":"多项填空","title":"联系方式：电话 {_}，邮箱 {_}"}\n' +
            '{"qtype":"表格填空","title":"报名人基础信息","rowtitle":["姓名","手机号","微信号","紧急联系人"]}\n' +
            '{"qtype":"表格数值","title":"活动参与与体能数据","rowtitle":["计划参与人数","每周打球次数","可接受人均费用(元)"],"minvalue":"0","maxvalue":"999"}\n' +
            '{"qtype":"表格下拉框","title":"个人水平与装备情况","rowtitle":["羽毛球水平","是否自带球拍","是否需要拼车"],"selects":[["新手","初级","中级","高级","校队/专业"],["是","否"],["是","否"]]}\n' +
            '{"qtype":"表格组合","title":"活动时间与场地偏好","rowtitle":["可参加时段","偏好场地类型","备注"],"types":["多选","下拉","文本"],"selects":[["工作日晚上","周末上午","周末下午","周末晚上"],["木地板","塑胶地","不限"],[]]}\n' +
            '{"qtype":"自增表格","title":"可参加日期清单","rowtitle":["可参加日期","可参加时段","是否可候补"],"columntitle":["日期","时段","是否可候补"],"selects":[["","工作日晚上|周末上午|周末下午|周末晚上","可以|不可以"]],"min_rows":1,"max_rows":5}\n' +
            '{"qtype":"投票单选","title":"你最喜欢哪个网站","select":["淘宝网","开心网","百度","腾讯","人人网"]}\n' +
            '{"qtype":"投票多选","title":"哪些网站是你经常使用的","select":["淘宝网","开心网","百度","腾讯","人人网"]}\n' +
            '{"qtype":"量表题","title":"满意度评分","select":["1","2","3","4","5"],"minvaluetext":"非常不满意","maxvaluetext":"非常满意"}',
        inputSchema: {
            jsonl: z.string().min(1).refine((value) => Buffer.byteLength(value, "utf8") <= MAX_JSONL_SIZE, `JSONL UTF-8 字节数不能超过 ${MAX_JSONL_SIZE}`).describe("JSONL 格式的问卷内容（每行一个 JSON 对象）。" +
                "硬性要求：1) 首行 qtype=问卷基础信息 的 title 必须是真实主题，不得为占位符 ??? / 无标题 / TODO / xxx；" +
                "2) 必须包含 ≥1 道真实题目（元数据/分页/段落/知情同意书不计）；" +
                "3) 默认所有题型必答，未指定 requir 时 SDK 会补 true，只有用户明确指定具体题目选填时才传 requir=false；违反会被 SDK 拒绝。"),
            title: z.string().optional().describe("覆盖 JSONL 中的问卷标题。同样适用占位符校验：禁止 ??? / 无标题 / TODO / xxx 等无语义值。"),
            optional_titles: z
                .array(z.string().min(1))
                .optional()
                .describe("允许设为选填的题目标题列表。默认所有题目必答；只有列在这里的题目才允许 requir=false"),
            atype: z
                .number()
                .int()
                .optional()
                .describe("问卷类型（**调用方应主动判断并显式传入**，不要依赖兜底）：" +
                "1=调查（默认）, 2=测评, 3=投票, 4=360度评估, 5=360评估无测评关系, 6=考试, 7=表单, 9=教学评估, 10=量表, 11=民主评议。" +
                "硬性规则：投票（含投票单选/投票多选） → 必传 atype=3；表单 → 必传 atype=7；考试 → 必传 atype=6；测评 → 必传 atype=2。" +
                "兜底（仅用于调用方遗漏时挽救，不应作为正常路径）：含考试题型→6；含投票题型或标题含「投票/评选」→3；含「表单/报名表/登记表/申请表」→7；含「测评」→2；其余 1。" +
                "显式传值始终优先于兜底推断。"),
            publish: z.boolean().optional().describe("是否立即发布；未指定时普通题型默认发布，包含纯框架题型（需二次编辑完善）时默认保持草稿"),
            creater: z.string().optional().describe("创建者子账号用户名"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
            title: "用 JSON 创建问卷",
        },
    }, async (args) => {
        try {
            if (args.atype !== undefined && !CREATABLE_SURVEY_ATYPES.has(args.atype)) {
                throw new Error("当前接口不支持创建该 atype。可创建类型：1、2、3、4、5、6、7、9、10、11；8=用户体系不支持新建。");
            }
            const expectedTitle = createTitle(args.jsonl, args.title);
            const expectedQuestionCount = createQuestionCount(args.jsonl);
            const expectedQuestionTypes = extractJsonlQuestionTypeExpectations(args.jsonl);
            return runVerifiedWrite({
                operation: "create_survey_by_json",
                write: () => createSurveyByJson({
                    jsonl: args.jsonl,
                    title: args.title,
                    atype: args.atype,
                    optionalTitles: args.optional_titles,
                    publish: args.publish,
                    creater: args.creater,
                }),
                verify: async ({ writeResult }) => {
                    const created = responseData(writeResult);
                    const rawVid = created?.vid ?? created?.activity ?? created?.id;
                    const vid = typeof rawVid === "number" ? rawVid : Number(rawVid);
                    if (!Number.isSafeInteger(vid) || vid <= 0) {
                        return verificationFailure("创建响应缺少可验证的问卷编号，无法执行读回验证", { link: false }, ["survey-id", "get_survey"]);
                    }
                    let readBack;
                    try {
                        readBack = await getSurvey({ vid });
                    }
                    catch (error) {
                        return verificationFailure(`创建后的问卷读取失败：${error instanceof Error ? error.message : String(error)}`, { link: false });
                    }
                    if (readBack.result !== true) {
                        return verificationFailure(readBack.errormsg || "创建后的问卷读回失败，结果未知", { link: false });
                    }
                    const data = responseData(readBack);
                    const questions = Array.isArray(data?.questions)
                        ? data.questions
                        : Array.isArray(data?.question) ? data.question : undefined;
                    const comparableQuestions = Array.isArray(questions)
                        ? filterJsonlVerificationQuestions(questions)
                        : undefined;
                    const titleMatches = expectedTitle === undefined || data?.title === expectedTitle;
                    const countMatches = expectedQuestionCount === undefined || (comparableQuestions !== undefined && comparableQuestions.length === expectedQuestionCount);
                    const typeCheck = Array.isArray(questions)
                        ? compareJsonlQuestionTypes(expectedQuestionTypes, questions)
                        : { matches: false, warnings: ["创建后的问卷未返回题目列表，无法校验 q_type/q_subtype"] };
                    const identityMatches = surveyIdentityMatches(data, vid);
                    const structure = identityMatches && titleMatches && countMatches && typeCheck.matches;
                    const status = statusLabel(data?.status) !== undefined;
                    const warnings = [...typeCheck.warnings];
                    if (!identityMatches)
                        warnings.push("创建后的问卷读回身份与请求不一致或缺少可验证编号");
                    if (!titleMatches)
                        warnings.push("创建后的问卷标题与请求不一致");
                    if (!countMatches)
                        warnings.push("创建后的题目数量与请求不一致或未返回");
                    if (!status)
                        warnings.push("创建后的问卷状态无法从读回响应确认");
                    const baseUrl = currentBaseUrl();
                    let linkEvidence = resolveRespondentLink(data, vid, baseUrl);
                    if (!linkEvidence.fillUrl) {
                        try {
                            const listed = await findListRecord(vid);
                            const fallback = resolveRespondentLink(listed, vid, baseUrl);
                            if (fallback.fillUrl)
                                linkEvidence = fallback;
                        }
                        catch (error) {
                            warnings.push(`创建后的问卷列表回退读取失败：${error instanceof Error ? error.message : String(error)}`);
                        }
                    }
                    const link = Boolean(linkEvidence.fillUrl);
                    if (!link)
                        warnings.push("创建后的问卷没有可验证的答题链接；未根据 vid 猜测公开链接");
                    const verified = structure && status && link;
                    return {
                        vid,
                        ...(linkEvidence.sid ? { sid: linkEvidence.sid } : typeof data?.sid === "string" ? { sid: data.sid } : {}),
                        ...(linkEvidence.fillUrl ? { fillUrl: linkEvidence.fillUrl } : {}),
                        ...(statusLabel(data?.status) ? { status: statusLabel(data?.status) } : {}),
                        outcome: verified ? "verified" : "unknown",
                        verification: { structure, status, count: countMatches, link },
                        warnings,
                        ...(verified ? {} : { verificationRequired: ["survey-structure", "survey-status", "respondent-link"] }),
                    };
                },
            });
        }
        catch (error) {
            return toolError(error);
        }
    });
}
//# sourceMappingURL=tools.js.map