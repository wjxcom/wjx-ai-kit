import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registerSurveyTools } from "./modules/survey/tools.js";
import { registerResponseTools } from "./modules/response/tools.js";
import { registerContactsTools } from "./modules/contacts/tools.js";
import { registerSsoTools } from "./modules/sso/tools.js";
import { registerUserSystemTools } from "./modules/user-system/tools.js";
import { registerMultiUserTools } from "./modules/multi-user/tools.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

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

  return server;
}
