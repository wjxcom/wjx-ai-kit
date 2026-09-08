import { readFileSync } from "node:fs";
import { queryResponses, queryResponsesRealtime, downloadResponses, getReport, submitResponse, getWinners, modifyResponse, get360Report, clearResponses, getSurvey, normalizeSubmitdata, buildSubmitTemplate, Action, } from "wjx-api-sdk";
import { CliError, ensureApiSuccess } from "../lib/errors.js";
import { strictInt, requireField, requirePositiveInt, requireEnum, requireIntRange, ensureJsonArray, getMerged, createCapturingFetch, printDryRunPreview } from "../lib/command-helpers.js";
import { applyProfileCredentials, getCredentials } from "../lib/auth.js";
import { resolveProfile } from "../lib/profiles.js";
import { handleError } from "../lib/errors.js";
import { formatOutput } from "../lib/output.js";
import { executeRuntimeAction, executeRuntimeCommand } from "../lib/runtime/executor.js";
import { buildRequestPlan } from "../lib/runtime/request-plan.js";
import { surveyIdentityMatches } from "../lib/runtime/identity.js";
function responseRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : undefined;
}
function responseNumber(value) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0)
        return value;
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed) && parsed >= 0)
            return parsed;
    }
    return undefined;
}
function responseMetric(data, keys) {
    for (const key of keys) {
        if (!data || !Object.hasOwn(data, key))
            continue;
        const value = responseNumber(data[key]);
        if (value !== undefined)
            return value;
    }
    return null;
}
function responseList(data) {
    if (Array.isArray(data))
        return data;
    const record = responseRecord(data);
    if (!record)
        return undefined;
    for (const key of ["responses", "answers", "rows", "list", "items"]) {
        if (Array.isArray(record[key]))
            return record[key];
    }
    return undefined;
}
function responseCountSnapshot(data) {
    const record = responseRecord(data);
    for (const key of ["total_count", "totalCount", "count", "answer_total", "answerTotal"]) {
        const count = responseNumber(record?.[key]);
        if (count !== undefined)
            return { count, empty: count === 0, known: true };
    }
    const list = responseList(data);
    if (list)
        return { count: list.length === 0 ? 0 : undefined, empty: list.length === 0, known: list.length === 0 };
    return { empty: false, known: false };
}
function responseRows(data) {
    const record = responseRecord(data);
    if (!record)
        return [];
    for (const key of ["responses", "answers", "rows", "list", "records", "items", "data"]) {
        const candidate = record[key];
        if (Array.isArray(candidate)) {
            return candidate.filter((value) => Boolean(responseRecord(value)));
        }
        const candidateRecord = responseRecord(candidate);
        if (candidateRecord) {
            const values = Object.values(candidateRecord)
                .filter((value) => Boolean(responseRecord(value)));
            if (values.length > 0)
                return values;
        }
    }
    return responseJid(record) === undefined ? [] : [record];
}
function responseJid(row) {
    const raw = row.jid ?? row.id ?? row.response_id ?? row.responseId;
    return raw === undefined || raw === null ? undefined : String(raw);
}
const ANSWER_VALUE_KEYS = [
    "answer_score", "answerScore", "answer_value", "answerValue", "item_value", "itemValue",
    "score", "score_value", "scoreValue", "value", "answer", "answer_text", "answerText", "content",
];
function answerValue(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return { found: true, value };
    const record = value;
    for (const key of ANSWER_VALUE_KEYS) {
        if (Object.hasOwn(record, key))
            return { found: true, value: record[key] };
    }
    return { found: false };
}
function sameQuestionKey(value, key) {
    if (value === undefined || value === null)
        return false;
    const text = String(value).trim();
    return text === key || (Number.isFinite(Number(text)) && Number(text) === Number(key));
}
function findAnswerInContainer(container, key) {
    if (Array.isArray(container)) {
        for (const item of container) {
            const record = responseRecord(item);
            if (!record)
                continue;
            if (sameQuestionKey(record.q_index ?? record.qid ?? record.q_id ?? record.question_id ?? record.questionId, key)) {
                const direct = answerValue(record);
                if (direct.found)
                    return direct;
            }
        }
        return { found: false };
    }
    const record = responseRecord(container);
    if (!record)
        return { found: false };
    if (Object.hasOwn(record, key))
        return answerValue(record[key]);
    for (const item of Object.values(record)) {
        const itemRecord = responseRecord(item);
        if (!itemRecord)
            continue;
        if (sameQuestionKey(itemRecord.q_index ?? itemRecord.qid ?? itemRecord.q_id ?? itemRecord.question_id ?? itemRecord.questionId, key)) {
            const direct = answerValue(itemRecord);
            if (direct.found)
                return direct;
        }
    }
    return { found: false };
}
function responseAnswer(row, key) {
    const candidateKeys = [key];
    const numericKey = Number(key);
    // Some API deployments expose q_index while the modify endpoint documents
    // the internal q_index * 10000 key. Try both representations when useful.
    if (Number.isSafeInteger(numericKey) && numericKey > 0 && numericKey < 10000) {
        candidateKeys.push(String(numericKey * 10000));
    }
    for (const candidate of candidateKeys) {
        if (Object.hasOwn(row, candidate)) {
            const direct = answerValue(row[candidate]);
            if (direct.found)
                return direct;
        }
        for (const containerKey of ["answer_items", "answerItems", "answers", "answer", "items"]) {
            const nested = findAnswerInContainer(row[containerKey], candidate);
            if (nested.found)
                return nested;
        }
    }
    return { found: false };
}
function comparableAnswer(value) {
    if (typeof value === "string")
        return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
        return String(value);
    if (typeof value === "boolean" || value === null)
        return String(value);
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
}
/** Accept the documented JSON patch and the legacy q$answer wire shorthand. */
function parseModifyAnswers(value) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new CliError("INPUT_ERROR", "--answers 必须是非空 JSON 对象（格式：{\"10000\":\"85\"}）");
    }
    try {
        const parsed = JSON.parse(value);
        const record = responseRecord(parsed);
        if (record && Object.keys(record).length > 0)
            return record;
    }
    catch {
        // Keep accepting the pre-0.4 q$answer shorthand for compatibility.
    }
    const legacy = {};
    for (const segment of value.split("}")) {
        if (!segment)
            continue;
        const separator = segment.indexOf("$");
        if (separator <= 0) {
            throw new CliError("INPUT_ERROR", "--answers 必须是合法 JSON 对象（或 q$answer 格式）");
        }
        const key = segment.slice(0, separator).trim();
        if (!key)
            throw new CliError("INPUT_ERROR", "--answers 中存在空题号");
        legacy[key] = segment.slice(separator + 1);
    }
    if (Object.keys(legacy).length > 0)
        return legacy;
    throw new CliError("INPUT_ERROR", "--answers 必须是非空 JSON 对象（格式：{\"10000\":\"85\"}）");
}
function findResponseByJid(data, jid) {
    const expected = String(jid);
    return responseRows(data).find((row) => responseJid(row) === expected);
}
async function readResponseCount(input, credentials) {
    const result = await queryResponses({ vid: input.vid, page_index: 1, page_size: 1 }, credentials);
    ensureApiSuccess(result);
    return responseCountSnapshot(result.data);
}
/** 规范化 submitdata 中的题号、矩阵题和排序题答案格式 */
export { buildSubmitTemplate } from "wjx-api-sdk";
export function registerResponseCommands(program) {
    const response = program.command("response").description("答卷管理");
    // --- count ---
    response
        .command("count")
        .description("获取问卷答卷总数")
        .option("--vid <n>", "问卷ID", strictInt)
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, queryResponses, (m) => {
            requireField(m, "vid");
            return { vid: m.vid, page_size: 1 };
        }, {
            transformResult: (result) => {
                const data = responseRecord(result.data);
                return {
                    total_count: responseMetric(data, ["total_count", "totalCount"]),
                    join_times: responseMetric(data, ["join_times", "joinTimes"]),
                };
            },
        });
    });
    // --- query ---
    response
        .command("query")
        .description("查询答卷")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--page_index <n>", "页码", strictInt)
        .option("--page_size <n>", "每页数量", strictInt)
        .option("--sort <n>", "排序", strictInt)
        .option("--min_index <n>", "最小序号", strictInt)
        .option("--jid <s>", "答卷ID")
        .option("--sojumpparm <s>", "自定义参数")
        .option("--qid <s>", "题目ID")
        .option("--begin_time <n>", "开始时间", strictInt)
        .option("--end_time <n>", "结束时间", strictInt)
        .option("--file_view_expires <n>", "文件链接有效期", strictInt)
        .option("--valid", "查询有效答卷（默认true）")
        .option("--query_note", "查询备注")
        .option("--distinct_user", "去重用户")
        .option("--distinct_sojumpparm", "去重参数")
        .option("--conds <json>", "查询条件JSON，格式：[{\"q_index\":10000,\"opt\":\"in\",\"val\":\"1,2\"}]，q_index=题序×10000，最多2个条件")
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, queryResponses, (m) => {
            requireField(m, "vid");
            if (m.page_index !== undefined)
                requirePositiveInt(m, "page_index");
            if (m.page_size !== undefined)
                requireIntRange(m, "page_size", 1, 50);
            if (m.sort !== undefined)
                requireEnum(m, "sort", [0, 1]);
            if (m.file_view_expires !== undefined)
                requirePositiveInt(m, "file_view_expires");
            return {
                vid: m.vid,
                page_index: m.page_index,
                page_size: m.page_size,
                sort: m.sort,
                min_index: m.min_index,
                jid: m.jid,
                sojumpparm: m.sojumpparm,
                qid: m.qid,
                begin_time: m.begin_time,
                end_time: m.end_time,
                file_view_expires: m.file_view_expires,
                valid: m.valid ?? true,
                query_note: m.query_note,
                distinct_user: m.distinct_user,
                distinct_sojumpparm: m.distinct_sojumpparm,
                conds: ensureJsonArray(m.conds, "conds"),
            };
        });
    });
    // --- realtime ---
    response
        .command("realtime")
        .description("实时查询最新答卷")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--count <n>", "数量", strictInt)
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, queryResponsesRealtime, (m) => {
            requireField(m, "vid");
            if (m.count !== undefined)
                requirePositiveInt(m, "count");
            return { vid: m.vid, count: m.count };
        });
    });
    // --- download ---
    response
        .command("download")
        .description("下载答卷")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--taskid <s>", "任务ID")
        .option("--query_count <n>", "查询数量", strictInt)
        .option("--begin_time <n>", "开始时间", strictInt)
        .option("--end_time <n>", "结束时间", strictInt)
        .option("--min_index <n>", "最小序号", strictInt)
        .option("--qid <s>", "题目ID")
        .option("--sort <n>", "排序", strictInt)
        .option("--query_type <n>", "查询类型", strictInt)
        .option("--suffix <n>", "导出格式: 0=CSV, 1=SAV, 2=Word", strictInt)
        .option("--query_record", "查询记录")
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, downloadResponses, (m) => {
            requireField(m, "vid");
            if (m.query_count !== undefined)
                requirePositiveInt(m, "query_count");
            if (m.sort !== undefined)
                requireEnum(m, "sort", [0, 1]);
            if (m.query_type !== undefined)
                requireEnum(m, "query_type", [0, 1, 2]);
            if (m.suffix !== undefined)
                requireEnum(m, "suffix", [0, 1, 2]);
            return {
                vid: m.vid,
                taskid: m.taskid,
                query_count: m.query_count,
                begin_time: m.begin_time,
                end_time: m.end_time,
                min_index: m.min_index,
                qid: m.qid,
                sort: m.sort,
                query_type: m.query_type,
                suffix: m.suffix,
                query_record: m.query_record,
            };
        });
    });
    // --- submit ---
    response
        .command("submit")
        .description("提交答卷（选项序号 1-based；题号使用 submit-template 返回的原始 q_index。默认会自动注入 jpmversion）")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--inputcosttime <n>", "填写耗时(秒)", strictInt)
        .option("--submitdata <s>", "提交数据，格式 `题号$答}题号$答}…`（题号必须使用服务端返回的原始 q_index，不保证连续）。Windows PowerShell 用户必须用单引号包裹（双引号会让 $1/$2/$3 被识别为变量并吞掉）；或改用 --submitdata-file 从文件读，彻底绕开 shell 转义")
        .option("--submitdata-file <path>", "从文件读取 submitdata（推荐：彻底绕开 PowerShell/bash 的 $ 变量展开问题）")
        .option("--udsid <n>", "用户系统ID", strictInt)
        .option("--sojumpparm <s>", "自定义参数")
        .option("--submittime <s>", "提交时间")
        .option("--jpmversion <n>", "问卷版本号；不传时默认自动从 getSurvey 取", strictInt)
        .option("--no-auto-version", "关闭自动获取 jpmversion（适用于显式传入或不需要校验场景）")
        .action(async (_opts, cmd) => {
        await executeRuntimeCommand(program, cmd, {
            normalize: ({ values }) => {
                requireField(values, "vid");
                requireField(values, "inputcosttime");
                if (typeof values.inputcosttime !== "number" ||
                    !Number.isInteger(values.inputcosttime) || values.inputcosttime < 2) {
                    throw new CliError("INPUT_ERROR", "--inputcosttime 必须是大于 1 的整数");
                }
                let submitdata = values.submitdata;
                const fileOpt = values.submitdataFile ?? values["submitdata-file"];
                if (typeof fileOpt === "string" && fileOpt) {
                    try {
                        submitdata = readFileSync(fileOpt, "utf8").replace(/^﻿/, "").trimEnd();
                    }
                    catch {
                        throw new CliError("INPUT_ERROR", `无法读取 --submitdata-file 指向的文件: ${fileOpt}`);
                    }
                }
                if (!submitdata) {
                    throw new CliError("INPUT_ERROR", "Missing required option: --submitdata 或 --submitdata-file");
                }
                if (!submitdata.includes("$")) {
                    throw new CliError("INPUT_ERROR", `submitdata 中未检测到任何 "$" 分隔符。问卷星答卷协议使用 "题序$答案" 格式（如 "1$男|2$跑步|3$5"），缺失 $ 几乎必然是 shell 转义问题。` +
                        `修复建议：① Windows PowerShell 请用单引号 '...' 包裹；② 或改用 --submitdata-file <path>，从文件读取，彻底绕开 shell 转义；③ 运行 \`wjx response submit-template --vid <问卷ID>\` 获取可直接填充的模板。`);
                }
                return {
                    vid: values.vid,
                    inputcosttime: values.inputcosttime,
                    submitdata,
                    udsid: values.udsid,
                    sojumpparm: values.sojumpparm,
                    submittime: values.submittime,
                    jpmversion: values.jpmversion,
                    autoVersion: values.autoVersion !== false,
                };
            },
            buildPlans: (input, context) => [buildRequestPlan({
                    service: "default",
                    action: Action.SUBMIT_RESPONSE,
                    url: context?.apiUrl,
                    body: {
                        action: Action.SUBMIT_RESPONSE,
                        vid: input.vid,
                        inputcosttime: input.inputcosttime,
                        submitdata: input.submitdata,
                        udsid: input.udsid,
                        sojumpparm: input.sojumpparm,
                        submittime: input.submittime,
                        jpmversion: input.jpmversion,
                    },
                    unresolved: input.autoVersion && input.jpmversion === undefined ? ["jpmversion"] : undefined,
                })],
            prepareExecute: async (input, creds, requestOptions) => {
                const explicitVersion = input.jpmversion;
                const autoVersion = input.autoVersion !== false;
                // 尽量复用 getSurvey 结果做 submitdata 规范化；显式版本只放宽
                // 元数据获取失败时的阻塞要求。
                let survey = null;
                if (autoVersion) {
                    try {
                        survey = await getSurvey({ vid: input.vid }, creds, undefined, requestOptions);
                        // Automatic version lookup is part of the submit safety contract.
                        // Never fall through to a potentially stale or unverifiable submit.
                        ensureApiSuccess(survey);
                    }
                    catch (error) {
                        if (explicitVersion === undefined && autoVersion)
                            throw error;
                        // An explicit caller-supplied version permits submission when
                        // metadata is unavailable; normalization is best effort.
                        survey = null;
                    }
                }
                const data = survey?.data;
                if (explicitVersion === undefined && autoVersion &&
                    (!Number.isSafeInteger(data?.version) || data?.version <= 0)) {
                    throw new CliError("API_ERROR", "自动获取问卷版本失败：API 响应缺少有效的正整数 version");
                }
                if (survey && !surveyIdentityMatches(data, input.vid)) {
                    throw new CliError("API_ERROR", `问卷 ${String(input.vid)} 读回身份不匹配或缺少可验证编号，已停止提交`);
                }
                const result = { ...input };
                // 不要把内部 autoVersion 透到 SDK
                delete result.autoVersion;
                if (explicitVersion === undefined && autoVersion && typeof data?.version === "number") {
                    result.jpmversion = data.version;
                }
                const questions = data?.questions ?? [];
                if (questions.length > 0 && typeof input.submitdata === "string") {
                    result.submitdata = normalizeSubmitdata(input.submitdata, questions);
                }
                return result;
            },
            execute: (input, credentials, requestOptions) => {
                const finalInput = { ...input };
                delete finalInput.autoVersion;
                return submitResponse(finalInput, credentials, undefined, requestOptions);
            },
        });
    });
    // --- modify ---
    response
        .command("modify")
        .description("修改答卷")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--jid <n>", "答卷ID", strictInt)
        .option("--answers <s>", "答案数据")
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, modifyResponse, (m) => {
            requireField(m, "vid");
            requireField(m, "jid");
            requireField(m, "answers");
            // Parse before the confirmation/transport boundary so malformed score
            // patches cannot trigger an unsafe write.
            parseModifyAnswers(m.answers);
            return { vid: m.vid, jid: m.jid, type: 1, answers: m.answers };
        }, {
            // A score update is unsafe and must establish that the target exists
            // before sending the write. The same target is read again afterwards
            // to prove the requested fields reached the server.
            preRead: async (input, credentials) => {
                const result = await queryResponses({
                    vid: input.vid,
                    jid: String(input.jid),
                    page_index: 1,
                    page_size: 50,
                }, credentials);
                ensureApiSuccess(result);
                const target = findResponseByJid(result.data, input.jid);
                if (!target) {
                    throw new CliError("API_ERROR", `未找到答卷 jid=${String(input.jid)}，已停止修改`);
                }
                return { target };
            },
            requiredVerification: ["structure", "status"],
            postVerify: async (_result, input, credentials) => {
                const requested = parseModifyAnswers(input.answers);
                let readBack;
                try {
                    readBack = await queryResponses({
                        vid: input.vid,
                        jid: String(input.jid),
                        page_index: 1,
                        page_size: 50,
                    }, credentials);
                    ensureApiSuccess(readBack);
                }
                catch (error) {
                    return {
                        jid: input.jid,
                        outcome: "unknown",
                        verification: { structure: false, status: false, link: true },
                        warnings: [
                            "修改后的答卷读取失败，结果未知",
                            error instanceof Error ? error.message : String(error),
                        ],
                    };
                }
                const target = findResponseByJid(readBack.data, input.jid);
                if (!target) {
                    return {
                        jid: input.jid,
                        outcome: "unknown",
                        verification: { structure: false, status: false, link: true },
                        warnings: [`修改后的答卷读回未找到 jid=${String(input.jid)}，结果未知`],
                    };
                }
                const missing = [];
                const mismatched = [];
                const verifiedAnswers = {};
                for (const [key, expected] of Object.entries(requested)) {
                    const actual = responseAnswer(target, key);
                    if (!actual.found) {
                        missing.push(key);
                        continue;
                    }
                    verifiedAnswers[key] = actual.value;
                    if (comparableAnswer(actual.value) !== comparableAnswer(expected))
                        mismatched.push(key);
                }
                const structure = responseJid(target) === String(input.jid);
                const status = structure && missing.length === 0 && mismatched.length === 0;
                const warnings = [];
                if (missing.length > 0)
                    warnings.push(`读回缺少可验证的分数/答案字段：${missing.join(", ")}`);
                if (mismatched.length > 0)
                    warnings.push(`读回分数/答案与请求不一致：${mismatched.join(", ")}`);
                return {
                    jid: input.jid,
                    answers: verifiedAnswers,
                    outcome: status ? "verified" : "unknown",
                    verification: { structure, status, link: true },
                    warnings,
                };
            },
        });
    });
    // --- clear ---
    response
        .command("clear")
        .description("清空答卷")
        .option("--username <s>", "用户名")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--reset_to_zero", "重置序号")
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, clearResponses, (m) => {
            requireField(m, "username");
            requireField(m, "vid");
            return {
                username: m.username,
                vid: m.vid,
                reset_to_zero: m.reset_to_zero ?? false,
            };
        }, {
            preRead: async (input, credentials) => readResponseCount(input, credentials),
            postVerify: async (_result, input, credentials, preReadResult) => {
                const before = preReadResult;
                let after;
                try {
                    after = await readResponseCount(input, credentials);
                }
                catch (error) {
                    return {
                        ...(before?.count !== undefined ? { beforeCount: before.count } : {}),
                        verification: { structure: false, status: false, link: true },
                        outcome: "unknown",
                        warnings: [
                            "清空后的答卷计数读取失败，结果未知",
                            error instanceof Error ? error.message : String(error),
                        ],
                    };
                }
                const verified = after.count === 0 || after.empty;
                const warnings = [];
                if (!verified) {
                    warnings.push(after.known
                        ? "清空后仍检测到答卷"
                        : "清空后的 API 响应缺少可验证的答卷计数，结果未知");
                }
                if (before && !before.known) {
                    warnings.push("清空前的 API 响应缺少可验证的答卷计数");
                }
                return {
                    ...(before?.count !== undefined ? { beforeCount: before.count } : {}),
                    ...(after.count !== undefined ? { afterCount: after.count } : {}),
                    verification: { structure: after.known || after.empty, status: verified, link: true },
                    outcome: verified ? "verified" : "unknown",
                    warnings,
                };
            },
        });
    });
    // --- report ---
    response
        .command("report")
        .description("获取统计报告")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--valid", "查询有效答卷（默认true）")
        .option("--min_index <n>", "最小序号", strictInt)
        .option("--jid <s>", "答卷ID")
        .option("--sojumpparm <s>", "自定义参数")
        .option("--begin_time <n>", "开始时间", strictInt)
        .option("--end_time <n>", "结束时间", strictInt)
        .option("--distinct_user", "去重用户")
        .option("--distinct_sojumpparm", "去重参数")
        .option("--conds <json>", "查询条件JSON，格式：[{\"q_index\":10000,\"opt\":\"in\",\"val\":\"1,2\"}]，q_index=题序×10000")
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, getReport, (m) => {
            requireField(m, "vid");
            return {
                vid: m.vid,
                valid: m.valid ?? true,
                min_index: m.min_index,
                jid: m.jid,
                sojumpparm: m.sojumpparm,
                begin_time: m.begin_time,
                end_time: m.end_time,
                distinct_user: m.distinct_user,
                distinct_sojumpparm: m.distinct_sojumpparm,
                conds: ensureJsonArray(m.conds, "conds"),
            };
        });
    });
    // --- files (已移除 — 仅限混合云/私有化场景) ---
    // --- winners ---
    response
        .command("winners")
        .description("获取中奖名单")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--atype <n>", "活动类型", strictInt)
        .option("--awardstatus <n>", "领奖状态", strictInt)
        .option("--page_index <n>", "页码", strictInt)
        .option("--page_size <n>", "每页数量", strictInt)
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, getWinners, (m) => {
            requireField(m, "vid");
            if (m.page_index !== undefined)
                requirePositiveInt(m, "page_index");
            if (m.page_size !== undefined)
                requirePositiveInt(m, "page_size");
            if (m.atype !== undefined)
                requireEnum(m, "atype", [-1, 0, 1]);
            if (m.awardstatus !== undefined)
                requireEnum(m, "awardstatus", [-1, 0, 1]);
            return {
                vid: m.vid,
                atype: m.atype,
                awardstatus: m.awardstatus,
                page_index: m.page_index,
                page_size: m.page_size,
            };
        });
    });
    // --- submit-template ---
    response
        .command("submit-template")
        .description("根据问卷结构生成 submitdata 模板：列出每题 1-based placeholder，AI 改成真实答案后即可调 submit；默认输出 ResultEnvelope")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--raw", "直接输出 submitdata 字符串（不包裹 JSON），便于重定向到文件")
        .action(async (_opts, cmd) => {
        try {
            const merged = getMerged(cmd);
            requireField(merged, "vid");
            const globalOpts = program.opts();
            if (globalOpts.dryRun) {
                const { fetchImpl, getCapturedRequest } = createCapturingFetch();
                const profile = resolveProfile({ profile: globalOpts.profile });
                await getSurvey({ vid: merged.vid, get_questions: true, get_items: true }, applyProfileCredentials({ apiKey: "dry-run" }, profile), fetchImpl);
                printDryRunPreview(getCapturedRequest(), globalOpts);
                return;
            }
            const creds = getCredentials(globalOpts);
            const survey = await getSurvey({ vid: merged.vid, get_questions: true, get_items: true }, creds);
            ensureApiSuccess(survey);
            const surveyData = survey.data;
            const template = buildSubmitTemplate(surveyData?.questions ?? []);
            if (merged.raw || globalOpts.format === "table") {
                process.stdout.write(template.submitdata);
                if (!template.submitdata.endsWith("\n"))
                    process.stdout.write("\n");
            }
            else {
                formatOutput({
                    vid: merged.vid,
                    title: surveyData?.title ?? "",
                    submitdata: template.submitdata,
                    questions: template.questions,
                    next_step: `把每题 placeholder 改成真实答案，存为 submitdata.txt 后运行：wjx response submit --vid ${merged.vid} --inputcosttime 30 --submitdata-file submitdata.txt`,
                }, globalOpts);
            }
        }
        catch (e) {
            handleError(e);
        }
    });
    // --- 360-report (placeholder section break) ---
    response
        .command("360-report")
        .description("获取360度报告")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--taskid <s>", "任务ID")
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, get360Report, (m) => {
            requireField(m, "vid");
            return { vid: m.vid, taskid: m.taskid };
        });
    });
}
//# sourceMappingURL=response.js.map