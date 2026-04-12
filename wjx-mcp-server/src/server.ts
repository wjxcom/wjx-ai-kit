import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { getWjxBaseUrl } from "wjx-api-sdk";
import { registerSurveyTools } from "./modules/survey/tools.js";
import { registerResponseTools } from "./modules/response/tools.js";
import { registerContactsTools } from "./modules/contacts/tools.js";
import { registerSsoTools } from "./modules/sso/tools.js";
import { registerUserSystemTools } from "./modules/user-system/tools.js";
import { registerMultiUserTools } from "./modules/multi-user/tools.js";
import { registerAnalyticsTools } from "./modules/analytics/tools.js";
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
      const apiKey = process.env.WJX_API_KEY || "";
      const maskedKey = apiKey
        ? apiKey.slice(0, 8) + "****" + apiKey.slice(-4)
        : "(未设置)";
      const baseUrl = getWjxBaseUrl();
      const corpId = process.env.WJX_CORP_ID || "(未设置)";

      // Detect config source
      const wjxrcPath = process.env.WJX_CONFIG_PATH || join(homedir(), ".wjxrc");
      const hasWjxrc = existsSync(wjxrcPath);
      let wjxrcInfo = "不存在";
      if (hasWjxrc) {
        try {
          const parsed = JSON.parse(readFileSync(wjxrcPath, "utf-8"));
          const fields = Object.keys(parsed).filter(k => parsed[k]);
          wjxrcInfo = `存在 (${wjxrcPath})，包含: ${fields.join(", ")}`;
        } catch {
          wjxrcInfo = `存在但解析失败 (${wjxrcPath})`;
        }
      }

      const config = {
        server_version: serverInfo.version,
        base_url: baseUrl,
        api_key: maskedKey,
        corp_id: corpId,
        wjxrc: wjxrcInfo,
        env_WJX_BASE_URL: process.env.WJX_BASE_URL || "(未设置，使用默认值)",
        transport: process.env.MCP_TRANSPORT || "stdio",
      };

      return toolResult(config, false);
    },
  );

  return server;
}
