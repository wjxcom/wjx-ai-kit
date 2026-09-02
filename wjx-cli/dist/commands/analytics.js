import { decodeResponses, calculateNps, calculateCsat, detectAnomalies, compareMetrics, decodePushPayload, } from "wjx-api-sdk";
import { CliError } from "../lib/errors.js";
import { requireField } from "../lib/command-helpers.js";
import { executeRuntimeLocal } from "../lib/runtime/executor.js";
function parseJsonValue(value, field) {
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        }
        catch {
            throw new CliError("INPUT_ERROR", `${field} 必须是合法的 JSON`);
        }
    }
    if (value !== null && typeof value === "object")
        return value;
    throw new CliError("INPUT_ERROR", `${field} 必须是 JSON 数组`);
}
function parseScoreArray(value, field, min, max) {
    const parsed = parseJsonValue(value, field);
    if (!Array.isArray(parsed)) {
        throw new CliError("INPUT_ERROR", `${field} 必须是数字数组`);
    }
    if (parsed.length === 0) {
        throw new CliError("INPUT_ERROR", `${field} 不能是空数组`);
    }
    for (const [index, score] of parsed.entries()) {
        if (!Number.isFinite(score) || !Number.isInteger(score) || score < min || score > max) {
            throw new CliError("INPUT_ERROR", `${field} 第 ${index + 1} 项必须是 ${min}-${max} 范围内的整数`);
        }
    }
    return parsed;
}
function parseScale(value) {
    if (value === undefined)
        return "5-point";
    if (value !== "5-point" && value !== "7-point") {
        throw new CliError("INPUT_ERROR", `--scale 必须是 5-point 或 7-point`);
    }
    return value;
}
export function registerAnalyticsCommands(program) {
    const analytics = program.command("analytics").description("数据分析");
    // --- decode ---
    analytics
        .command("decode")
        .description("解码答卷提交数据")
        .option("--submitdata <s>", "提交数据字符串")
        .action(async (_opts, cmd) => {
        await executeRuntimeLocal(program, cmd, (m) => {
            if (m.submitdata === undefined || m.submitdata === null ||
                (typeof m.submitdata === "string" && m.submitdata.trim() === "")) {
                throw new CliError("INPUT_ERROR", "Missing required option: --submitdata");
            }
            if (typeof m.submitdata !== "string") {
                throw new CliError("INPUT_ERROR", "--submitdata 必须是字符串");
            }
            for (const [index, segment] of m.submitdata.split("}").entries()) {
                const trimmed = segment.trim();
                if (trimmed && !/^[1-9]\d*\$/.test(trimmed)) {
                    throw new CliError("INPUT_ERROR", `--submitdata 第 ${index + 1} 段必须使用题序$答案格式`);
                }
            }
            return decodeResponses(m.submitdata);
        });
    });
    // --- nps ---
    analytics
        .command("nps")
        .description("计算NPS分数")
        .option("--scores <json>", "评分JSON数组")
        .action(async (_opts, cmd) => {
        await executeRuntimeLocal(program, cmd, (m) => {
            requireField(m, "scores");
            const scores = parseScoreArray(m.scores, "--scores", 0, 10);
            return calculateNps(scores);
        });
    });
    // --- csat ---
    analytics
        .command("csat")
        .description("计算CSAT分数")
        .option("--scores <json>", "评分JSON数组")
        .option("--scale <s>", "量表类型: 5-point 或 7-point", "5-point")
        .action(async (_opts, cmd) => {
        await executeRuntimeLocal(program, cmd, (m) => {
            requireField(m, "scores");
            const scale = parseScale(m.scale);
            const scores = parseScoreArray(m.scores, "--scores", 1, scale === "5-point" ? 5 : 7);
            return calculateCsat(scores, scale);
        });
    });
    // --- anomalies ---
    analytics
        .command("anomalies")
        .description("检测异常答卷")
        .option("--responses <json>", "答卷数据JSON数组")
        .action(async (_opts, cmd) => {
        await executeRuntimeLocal(program, cmd, (m) => {
            requireField(m, "responses");
            const responses = typeof m.responses === "string" ? JSON.parse(m.responses) : m.responses;
            if (!Array.isArray(responses)) {
                throw new CliError("INPUT_ERROR", "--responses 必须是 JSON 数组");
            }
            if (responses.some((response) => !response || typeof response !== "object" || Array.isArray(response))) {
                throw new CliError("INPUT_ERROR", "--responses 每一项必须是对象");
            }
            return detectAnomalies(responses);
        });
    });
    // --- compare ---
    analytics
        .command("compare")
        .description("对比两组指标")
        .option("--set_a <json>", "指标集A JSON对象")
        .option("--set_b <json>", "指标集B JSON对象")
        .action(async (_opts, cmd) => {
        await executeRuntimeLocal(program, cmd, (m) => {
            requireField(m, "set_a");
            requireField(m, "set_b");
            const setA = typeof m.set_a === "string" ? JSON.parse(m.set_a) : m.set_a;
            const setB = typeof m.set_b === "string" ? JSON.parse(m.set_b) : m.set_b;
            if (!setA || typeof setA !== "object" || Array.isArray(setA) ||
                !setB || typeof setB !== "object" || Array.isArray(setB)) {
                throw new CliError("INPUT_ERROR", "--set_a 和 --set_b 必须是 JSON 对象");
            }
            for (const [name, value] of [...Object.entries(setA), ...Object.entries(setB)]) {
                if (typeof value !== "number" || !Number.isFinite(value)) {
                    throw new CliError("INPUT_ERROR", `指标 ${name} 必须是有限数字`);
                }
            }
            return compareMetrics(setA, setB);
        });
    });
    // --- decode-push ---
    analytics
        .command("decode-push")
        .description("解码推送回调数据")
        .option("--payload <s>", "加密数据")
        .option("--app_key <s>", "AppKey")
        .option("--signature <s>", "签名")
        .option("--raw_body <s>", "原始请求体")
        .action(async (_opts, cmd) => {
        await executeRuntimeLocal(program, cmd, (m) => {
            requireField(m, "payload");
            requireField(m, "app_key");
            return decodePushPayload(m.payload, m.app_key, m.signature, m.raw_body);
        });
    });
}
//# sourceMappingURL=analytics.js.map