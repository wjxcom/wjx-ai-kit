import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { getWjxBaseUrl } from "wjx-api-sdk";
import { getRequestCredentials } from "./core/context.js";
import { registerSurveyTools } from "./modules/survey/tools.js";
import { registerResponseTools } from "./modules/response/tools.js";
import { registerContactsTools } from "./modules/contacts/tools.js";
import { registerSsoTools } from "./modules/sso/tools.js";
import { registerUserSystemTools } from "./modules/user-system/tools.js";
import { registerMultiUserTools } from "./modules/multi-user/tools.js";
import { registerAnalyticsTools } from "./modules/analytics/tools.js";
import { registerDslTools } from "./modules/dsl/tools.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { toolResult } from "./helpers.js";

function getPackageVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"));
    return String(pkg.version || "0.0.0");
  } catch {
    return "0.0.0";
  }
}

const serverInfo = {
  name: "wjx-mcp-server",
  version: getPackageVersion(),
};

/** Mask API keys without exposing short credentials in diagnostics. */
export function maskApiKeyForDisplay(apiKey: string): string {
  if (!apiKey) return "(未设置)";
  if (apiKey.length <= 12) return "****";
  return `${apiKey.slice(0, 8)}****${apiKey.slice(-4)}`;
}

export function createServer(): McpServer {
  const server = new McpServer(serverInfo, {
    capabilities: { tools: {}, resources: {}, prompts: {} },
  });

  // ═══ MCP Resources ═══════════════════════════════════════════════════
  registerResources(server);

  // ═══ MCP Prompts ═════════════════════════════════════════════════════
  registerPrompts(server);

  // ═══ Module Tools ════════════════════════════════════════════════════
  registerSurveyTools(server);
  registerResponseTools(server);
  registerContactsTools(server);
  registerSsoTools(server);
  registerUserSystemTools(server);
  registerMultiUserTools(server);
  registerAnalyticsTools(server);
  registerDslTools(server);

  // ═══ Diagnostics ═════════════════════════════════════════════════════
  server.registerTool(
    "get_config",
    {
      title: "查看当前配置",
      description:
        "返回 MCP Server 当前使用的 API Base URL、API Key（脱敏）、Corp ID、配置来源等诊断信息。纯本地读取，不调用 API。",
      inputSchema: {},
      annotations: {
        openWorldHint: false,
        destructiveHint: false,
        idempotentHint: true,
        title: "查看当前配置",
      },
    },
    async () => {
      // HTTP requests may carry a tenant-specific Bearer credential. Report
      // that request-scoped identity instead of the process-wide fallback.
      const requestCredentials = getRequestCredentials();
      const apiKey = requestCredentials?.apiKey?.trim() || process.env.WJX_API_KEY?.trim() || "";
      const maskedKey = maskApiKeyForDisplay(apiKey);
      const baseUrl = getWjxBaseUrl(requestCredentials?.baseUrl);
      const corpId = requestCredentials?.corpId?.trim() || process.env.WJX_CORP_ID?.trim() || "(未设置)";

      // Detect config source
      const wjxrcPath = process.env.WJX_CONFIG_PATH?.trim() || join(homedir(), ".wjxrc");
      const hasWjxrc = existsSync(wjxrcPath);
      let wjxrcInfo = "不存在";
      if (hasWjxrc) {
        try {
          const parsed = JSON.parse(readFileSync(wjxrcPath, "utf-8"));
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            wjxrcInfo = `存在但格式无效 (${wjxrcPath})`;
          } else {
            const fields = Object.entries(parsed)
              .filter(([, value]) => typeof value === "string" && value.trim())
              .map(([key]) => key);
            wjxrcInfo = `存在 (${wjxrcPath})，包含: ${fields.join(", ") || "无有效配置项"}`;
          }
        } catch {
          wjxrcInfo = `存在但解析失败 (${wjxrcPath})`;
        }
      }

      // Detect wjx-cli availability
      let cliVersion = "(未安装)";
      try {
        cliVersion = execSync("wjx --version", { timeout: 5000, encoding: "utf-8" }).trim();
      } catch { /* not installed */ }

      const config = {
        server_version: serverInfo.version,
        base_url: baseUrl,
        api_key: maskedKey,
        corp_id: corpId,
        wjxrc: wjxrcInfo,
        cli_version: cliVersion,
        env_WJX_BASE_URL: process.env.WJX_BASE_URL?.trim() || "(未设置，使用默认值)",
        transport: process.env.MCP_TRANSPORT?.trim() || "stdio",
      };

      return toolResult(config, false);
    },
  );

  return server;
}
