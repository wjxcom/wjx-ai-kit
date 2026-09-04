#!/usr/bin/env node
/**
 * Check that active documentation and AI consumers describe the current
 * capability boundary. Historical changelogs and the legacy DSL page are
 * deliberately excluded from current-use wording checks.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

const markdownRoots = [
  "wjx-docs",
  "wjx-skills/wjx-cli-use",
  "wjx-skills/wjx-mcp-use",
  "wjx-skills/wjx-survey-ppt",
  "skills/wjx-cli-use",
  "wjx-cli/bundled",
  "wjx-agents",
  ".claude/agents",
];
const rootDocs = [
  "README.md",
  "CLAUDE.md",
  "wjx-api-sdk/README.md",
  "wjx-mcp-server/README.md",
  "wjx-mcp-server/CLAUDE.md",
  "wjx-mcp-server/docs/architecture.md",
  "wjx-cli/README.md",
];

function collectMarkdown(relativeRoot) {
  const absoluteRoot = join(ROOT, relativeRoot);
  if (!existsSync(absoluteRoot)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(relative(ROOT, absolute).replaceAll("\\", "/"));
    }
  };
  visit(absoluteRoot);
  return files;
}

const files = [...new Set([...rootDocs, ...markdownRoots.flatMap(collectMarkdown)])]
  .filter((file) => existsSync(join(ROOT, file)));
const isHistorical = (file) => file.endsWith("/CHANGELOG.md")
  || file === "CHANGELOG.md"
  || file === "wjx-docs/changelog.md"
  || file.startsWith("wjx-docs/legacy/");
const activeFiles = files.filter((file) => !isHistorical(file));

function readNormalized(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function lineHasHistoricalContext(line) {
  return /不提供|不注册|不导出|不再|已移除|已删除|旧|历史|迁移|转换|禁止|不得|不能|不要|legacy|removed|deprecated|not\s+(?:provide|register|export|create)|outside/i.test(line);
}

const oldCreationTokens = /create-by-text|create-by-json|createSurveyByText|textToSurvey|create_survey_by_text|create_survey(?!_by_json|_from_definition)|\bcreateSurvey(?!ByJson|FromDefinition)\b/;
const creationWords = /创建|新建|入口|调用|使用|create|survey/i;
const mcpFullClaims = /MCP[^\r\n]{0,100}(?:所有|全部|完整)(?:的)?(?:问卷星相关任务|能力|操作|工作流)|MCP[^\r\n]{0,100}\b(?:all|full|complete)\b[^\r\n]{0,60}(?:task|capabilit|operation|parity)/i;
const responseCountClaim = /(?:response|答卷)[^\r\n]{0,30}9\s*(?:个|tools?|工具)|9\s*(?:个|tools?|工具)[^\r\n]{0,30}(?:response|答卷)/i;
const dslOnlyClaim = /只有[^\r\n]{0,50}(?:已弃用|过时|deprecated)[^\r\n]{0,50}DSL/i;

for (const file of activeFiles) {
  const text = readFileSync(join(ROOT, file), "utf8");
  text.split(/\r?\n/).forEach((line, index) => {
    if (oldCreationTokens.test(line) && creationWords.test(line) && !lineHasHistoricalContext(line)) {
      failures.push(`${file}:${index + 1}: active documentation presents a removed creation path as current`);
    }
    if (mcpFullClaims.test(line)) failures.push(`${file}:${index + 1}: MCP is described as having full parity instead of the documented core subset`);
    if (responseCountClaim.test(line)) failures.push(`${file}:${index + 1}: stale response-tool count (9)`);
    if (dslOnlyClaim.test(line)) failures.push(`${file}:${index + 1}: DSL guidance is limited to a deprecated compatibility entry`);
  });
}

const combined = activeFiles.map((file) => readFileSync(join(ROOT, file), "utf8")).join("\n");
for (const file of activeFiles) {
  const text = readFileSync(join(ROOT, file), "utf8");
  if (text.includes("npm install -g wjx-cli@latest")
    && !text.includes("wjx skill install --force")) {
    failures.push(`${file}: CLI installation guidance must install wjx-cli-use in the same command`);
  }
  if (text.includes("npm install -g wjx-cli@latest && wjx skill install --force")) {
    failures.push(`${file}: AI installation guidance must use two sequential commands so Windows PowerShell 5.1 can execute it`);
  }
}
for (const required of ["preview-url", "count_responses", "build_submit_template", "decode_push_payload", "decodePushPayload"]) {
  if (!combined.includes(required)) failures.push(`active documentation is missing required capability name: ${required}`);
}
if (!combined.includes("npm install -g wjx-cli@latest") || !combined.includes("wjx skill install --force")) {
  failures.push("active documentation is missing the AI CLI installation and Skill setup commands");
}
if (!combined.includes("安装后命令名是 `wjx`")) {
  failures.push("active documentation does not distinguish the npm package name wjx-cli from the executable wjx");
}

const installationPromptFiles = [
  "README.md",
  "wjx-cli/README.md",
  "wjx-docs/start/cli.md",
  "wjx-skills/wjx-cli-use/SKILL.md",
  "wjx-agents/wjx-cli-expert/README.md",
];
const installationPromptRequirements = [
  "请帮我安装并配置问卷星 CLI（wjx-cli）",
  "node --version",
  "等我把 Key 发给你",
  "私有化部署用户",
  "wjx doctor",
  "wjx survey list --format table",
  "不要在回复、日志或文件中回显完整 API Key",
  "人工验收",
];
for (const file of installationPromptFiles) {
  const text = readFileSync(join(ROOT, file), "utf8");
  for (const required of installationPromptRequirements) {
    if (!text.includes(required)) {
      failures.push(`${file}: AI installation prompt is missing required step: ${required}`);
    }
  }
}

// These copies are consumed by different installation paths. A stale setup
// script or agent mirror is a functional documentation bug, not just a diff
// cleanliness issue, so compare them after normalizing EOLs.
const mirrorPairs = [
  ["wjx-skills/wjx-cli-use/SKILL.md", "skills/wjx-cli-use/SKILL.md"],
  ["wjx-skills/wjx-cli-use/setup.sh", "skills/wjx-cli-use/setup.sh"],
  ["wjx-skills/wjx-cli-use/SKILL.md", "wjx-cli/bundled/wjx-cli-use/SKILL.md"],
  ["wjx-agents/wjx-cli-expert/wjx-cli-expert.md", ".claude/agents/wjx-cli-expert.md"],
  ["wjx-agents/wjx-cli-expert/wjx-cli-expert.md", "wjx-cli/bundled/wjx-cli-expert.md"],
];
for (const [source, mirror] of mirrorPairs) {
  if (!existsSync(join(ROOT, source)) || !existsSync(join(ROOT, mirror))) {
    failures.push(`documentation mirror missing: ${source} -> ${mirror}`);
  } else if (readNormalized(source) !== readNormalized(mirror)) {
    failures.push(`documentation mirror drift: ${source} != ${mirror}`);
  }
}

const cliSetup = readNormalized("wjx-skills/wjx-cli-use/setup.sh");
for (const required of [
  "npm install -g wjx-cli@latest && wjx skill install --force",
  "wjx --version",
  "wjx doctor",
  "wjx survey list --format table",
  "WJX_BASE_URL",
  "weixinlogin.aspx?redirecturl=",
]) {
  if (!cliSetup.includes(required)) {
    failures.push(`wjx-cli-use/setup.sh: installation flow is missing required behavior: ${required}`);
  }
}

const mcpAgentReadme = readNormalized("wjx-agents/wjx-mcp-expert/README.md");
for (const required of ["skills/wjx-mcp-use", ".claude/skills/wjx-mcp-use"]) {
  if (!mcpAgentReadme.includes(required)) {
    failures.push(`wjx-mcp-expert/README.md: MCP Skill installation is missing canonical destination ${required}`);
  }
}

const localMcpAgent = ".claude/agents/wjx-survey.md";
if (existsSync(join(ROOT, localMcpAgent))) {
  const text = readNormalized(localMcpAgent);
  for (const required of ["核心业务子集", "create_survey_by_json", "纯框架题型", ".claude/skills/wjx-mcp-use"]) {
    if (!text.includes(required)) {
      failures.push(`${localMcpAgent}: local MCP Agent copy is missing current guidance: ${required}`);
    }
  }
}

if (!/(?:CLI|cli)[^\r\n]{0,240}(?:ok\s*[/,]?(?:data|error)|ok\/data\/meta|envelope)/i.test(combined)) {
  failures.push("active documentation does not describe the CLI ok/data envelope");
}
if (!/SDK[^\r\n]{0,240}(?:result\s*:\s*false|OpenAPI[^\r\n]{0,30}原始|原始响应)/i.test(combined)) {
  failures.push("active documentation does not distinguish SDK raw OpenAPI responses");
}

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Documentation consumer contract passed (${activeFiles.length} active Markdown files).\n`);
}

export { activeFiles, isHistorical, lineHasHistoricalContext };
