import { Command } from "commander";
import { createRequire } from "node:module";
import { listSurveys } from "wjx-api-sdk";
import { getCredentials } from "../lib/auth.js";
import { formatOutput } from "../lib/output.js";
import { handleError } from "../lib/errors.js";
import { loadConfig, CONFIG_PATH } from "../lib/config.js";

const require = createRequire(import.meta.url);
const sdkPkg = require("wjx-api-sdk/package.json");

function maskApiKey(value: string): string {
  if (value.length <= 4) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

export function registerDiagnosticCommands(program: Command): void {
  // --- whoami ---
  program
    .command("whoami")
    .description("验证 ApiKey 并显示账号信息")
    .action(async () => {
      try {
        const creds = getCredentials(program.opts());
        const result = await listSurveys(
          { page_index: 1, page_size: 1 },
          creds,
        );

        if (result.result === false) {
          // API Key invalid or API error
          formatOutput({ authenticated: false, error: result.errormsg || "ApiKey 无效" }, program.opts());
          process.exit(1);
        }

        // Extract useful info from the response
        const data = result as unknown as Record<string, unknown>;
        formatOutput({
          authenticated: true,
          total_surveys: data.total ?? data.Total ?? null,
        }, program.opts());
      } catch (e) {
        handleError(e);
      }
    });

  // --- doctor ---
  program
    .command("doctor")
    .description("环境诊断（ApiKey、网络、SDK 版本）")
    .action(async () => {
      try {
        const checks: Array<{ check: string; status: string; detail: string }> = [];

        // 0. Config file
        const config = loadConfig();
        checks.push({
          check: "配置文件",
          status: config ? "ok" : "info",
          detail: config ? CONFIG_PATH : `未找到 (运行 wjx init 创建)`,
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
        const apiKey = program.opts().apiKey || process.env.WJX_API_KEY || config?.apiKey;
        checks.push({
          check: "WJX_API_KEY",
          status: apiKey ? "ok" : "fail",
          detail: apiKey ? `已设置 (${maskApiKey(apiKey)})` : "未设置",
        });

        // 3. WJX_CORP_ID
        const corpId = process.env.WJX_CORP_ID || config?.corpId;
        checks.push({
          check: "WJX_CORP_ID",
          status: corpId ? "ok" : "info",
          detail: corpId ? `已设置 (${corpId})` : "未设置（通讯录功能需要）",
        });

        // 4. WJX_BASE_URL
        const baseUrl = process.env.WJX_BASE_URL || config?.baseUrl || "https://www.wjx.cn";
        checks.push({
          check: "WJX_BASE_URL",
          status: "ok",
          detail: baseUrl,
        });

        // 5. API connectivity
        if (apiKey) {
          try {
            const creds = { apiKey };
            const result = await listSurveys({ page_index: 1, page_size: 1 }, creds);
            if (result.result === false) {
              checks.push({
                check: "API 连接",
                status: "fail",
                detail: result.errormsg || "API 请求失败",
              });
            } else {
              checks.push({
                check: "API 连接",
                status: "ok",
                detail: "正常",
              });
            }
          } catch (err) {
            checks.push({
              check: "API 连接",
              status: "fail",
              detail: err instanceof Error ? err.message : String(err),
            });
          }
        } else {
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
        formatOutput({ ok: allOk, checks }, program.opts());

        if (!allOk) process.exit(1);
      } catch (e) {
        handleError(e);
      }
    });
}
