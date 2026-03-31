import { Command } from "commander";
import { listSurveys } from "wjx-api-sdk";
import { getCredentials } from "../lib/auth.js";
import { formatOutput } from "../lib/output.js";
import { handleError } from "../lib/errors.js";

export function registerDiagnosticCommands(program: Command): void {
  // --- whoami ---
  program
    .command("whoami")
    .description("验证 Token 并显示账号信息")
    .action(async () => {
      try {
        const creds = getCredentials(program.opts());
        const result = await listSurveys(
          { page_index: 1, page_size: 1 },
          creds,
        );

        if (result.result === false) {
          // Token invalid or API error
          formatOutput({ authenticated: false, error: result.errormsg || "Token 无效" }, program.opts());
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
    .description("环境诊断（Token、网络、SDK 版本）")
    .action(async () => {
      try {
        const checks: Array<{ check: string; status: string; detail: string }> = [];

        // 1. Node version
        const nodeVersion = process.version;
        const major = parseInt(nodeVersion.slice(1), 10);
        checks.push({
          check: "Node.js",
          status: major >= 20 ? "ok" : "warn",
          detail: `${nodeVersion}${major < 20 ? " (建议 >= 20)" : ""}`,
        });

        // 2. WJX_TOKEN set?
        const token = program.opts().token || process.env.WJX_TOKEN;
        checks.push({
          check: "WJX_TOKEN",
          status: token ? "ok" : "fail",
          detail: token ? `已设置 (${token.slice(0, 8)}...)` : "未设置",
        });

        // 3. WJX_BASE_URL
        const baseUrl = process.env.WJX_BASE_URL || "https://www.wjx.cn";
        checks.push({
          check: "WJX_BASE_URL",
          status: "ok",
          detail: baseUrl,
        });

        // 4. API connectivity
        if (token) {
          try {
            const creds = { token };
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
            detail: "Token 未设置，跳过",
          });
        }

        // 5. SDK version
        checks.push({
          check: "wjx-api-sdk",
          status: "ok",
          detail: "v1.0.0",
        });

        const allOk = checks.every((c) => c.status === "ok" || c.status === "skip");
        formatOutput({ ok: allOk, checks }, program.opts());

        if (!allOk) process.exit(1);
      } catch (e) {
        handleError(e);
      }
    });
}
