const path = require("node:path");

const ROOT = path.join(__dirname, "../..");
const DOCS_DIR = path.join(ROOT, "wjx-docs");

// Markdown is the source of truth. Order here is the public information architecture.
const MANIFEST = [
  { group: "开始使用", items: [
    ["index", "文档总览"],
    ["start/cli", "CLI 快速开始"],
    ["start/mcp", "MCP 快速开始"],
    ["start/sdk", "SDK 快速开始"],
  ]},
  { group: "按任务查找", items: [
    ["tasks/create-survey", "创建问卷"],
    ["tasks/analyze-responses", "分析答卷"],
    ["tasks/export-responses", "导出答卷"],
    ["tasks/configure-client", "配置 AI 客户端"],
  ]},
  { group: "参考", items: [
    ["reference/cli", "CLI 命令"],
    ["reference/mcp-tools", "MCP 工具"],
    ["reference/sdk", "SDK API"],
    ["reference/config", "配置项"],
    ["reference/question-types", "题型与 JSONL"],
  ]},
  { group: "概念与运维", items: [
    ["concepts/architecture", "架构与边界"],
    ["concepts/authentication", "认证与安全"],
    ["concepts/compatibility", "兼容性与弃用"],
    ["operations/http", "HTTP 部署"],
    ["operations/troubleshooting", "故障排查"],
  ]},
  { group: "集成", collapsed: true, items: [
    ["integrations/claude-code", "Claude Code"],
    ["integrations/claude-desktop", "Claude Desktop"],
    ["integrations/ide", "IDE 客户端"],
    ["integrations/workbench", "工作台与 Claw"],
  ]},
  { group: "兼容与变更", collapsed: true, items: [
    ["legacy/dsl", "DSL 兼容"],
    ["changelog", "变更记录"],
    ["migration", "迁移指南"],
  ]},
  { group: "AI 主页接口", collapsed: true, items: [
    ["tasks/ai-page-api-integration", "AI 主页接口集成"],
  ]},
];

const entries = MANIFEST.flatMap((group) => group.items.map(([key, label]) => ({ key, label, group: group.group })));

module.exports = { ROOT, DOCS_DIR, MANIFEST, entries };
