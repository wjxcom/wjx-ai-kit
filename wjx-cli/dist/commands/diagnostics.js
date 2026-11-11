import { createRequire } from "node:module";
import { listSurveys } from "wjx-api-sdk";
import { getCredentials } from "../lib/auth.js";
import { maskApiKey } from "../lib/mask.js";
import { loadConfig, getConfigPath } from "../lib/config.js";
import { resolveProfile } from "../lib/profiles.js";
import { executeRuntimeAction, executeRuntimeLocal } from "../lib/runtime/executor.js";
function nonBlank(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
const require = createRequire(import.meta.url);
const sdkPkg = require("wjx-api-sdk/package.json");
export function registerDiagnosticCommands(program) {
    // --- whoami ---
    program
        .command("whoami")
        .description("验证 ApiKey 并显示账号信息")
        .action(async (_opts, cmd) => {
        await executeRuntimeAction(program, cmd, listSurveys, () => ({ page_index: 1, page_size: 1 }), {
            dryRunNoRequest: true,
            transformResult: (result) => {
                const data = result;
                const payload = result.data;
                return {
                    authenticated: true,
                    total_surveys: data.total ?? data.Total ?? payload?.total_count ?? null,
                };
            },
        });
    });
    // --- doctor ---
    program
        .command("doctor")
        .description("环境诊断（ApiKey、网络、SDK 版本）")
        .action(async (_opts, cmd) => {
        await executeRuntimeLocal(program, cmd, async () => {
            const profile = resolveProfile({ profile: program.opts().profile });
            const checks = [];
            checks.push({ check: "profile", status: "ok", detail: profile.name });
            // 0. Config file
            const config = loadConfig();
            checks.push({
                check: "配置文件",
                status: config ? "ok" : "info",
                detail: config ? getConfigPath() : `未找到 (运行 wjx init 创建)`,
            });
            // 1. Node version
            const nodeVersion = process.version;
            const major = parseInt(nodeVersion.slice(1), 10);
            checks.push({
                check: "Node.js",
                status: major >= 20 ? "ok" : "warn",
                detail: `${nodeVersion}${major < 20 ? " (建议 >= 20)" : ""}`,
            });
            // 2. WJX_API_KEY set?
            let credentials;
            try {
                credentials = getCredentials({ apiKey: program.opts().apiKey, profile: program.opts().profile });
            }
            catch { /* reported as fail below */ }
            const apiKey = nonBlank(credentials?.apiKey);
            checks.push({
                check: "WJX_API_KEY",
                status: apiKey ? "ok" : "fail",
                detail: apiKey ? `已设置 (${maskApiKey(apiKey)})` : "未设置",
            });
            // 3. WJX_CORP_ID
            const corpId = nonBlank(credentials?.corpId) ?? nonBlank(profile.corpId);
            checks.push({
                check: "WJX_CORP_ID",
                status: corpId ? "ok" : "info",
                detail: corpId ? `已设置 (${corpId})` : "未设置（通讯录功能需要）",
            });
            // 4. WJX_BASE_URL
            const baseUrl = nonBlank(credentials?.baseUrl) ?? nonBlank(profile.baseUrl) ?? "https://www.wjx.cn";
            checks.push({
                check: "WJX_BASE_URL",
                status: "ok",
                detail: baseUrl,
            });
            // 5. API connectivity
            if (apiKey) {
                try {
                    const result = await listSurveys({ page_index: 1, page_size: 1 }, credentials);
                    if (result.result === false) {
                        checks.push({
                            check: "API 连接",
                            status: "fail",
                            detail: result.errormsg || "API 请求失败",
                        });
                    }
                    else {
                        checks.push({
                            check: "API 连接",
                            status: "ok",
                            detail: "正常",
                        });
                    }
                }
                catch (err) {
                    checks.push({
                        check: "API 连接",
                        status: "fail",
                        detail: err instanceof Error ? err.message : String(err),
                    });
                }
            }
            else {
                checks.push({
                    check: "API 连接",
                    status: "skip",
                    detail: "ApiKey 未设置，跳过",
                });
            }
            // 6. SDK version
            checks.push({
                check: "wjx-api-sdk",
                status: "ok",
                detail: `v${sdkPkg.version}`,
            });
            const allOk = checks.every((c) => c.status === "ok" || c.status === "skip" || c.status === "info");
            return { ok: allOk, data: { checks } };
        }, {
            dryRun: () => ({ command: "doctor", note: "doctor dry-run 不执行 API 连接检查" }),
            exitCode: (result) => result && typeof result === "object" && "ok" in result && result.ok === false ? 1 : undefined,
        });
    });
}
//# sourceMappingURL=diagnostics.js.map