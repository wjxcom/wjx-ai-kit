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

function lineHasHistoricalContext(line) {
  return /不提供|不注册|不导出|不再|已移除|已删除|旧|历史|迁移|转换|禁止|不得|不能|不要|legacy|removed|deprecated|not\s+(?:provide|register|export|create)|outside/i.test(line);
}

const oldCreationTokens = /create-by-text|create-by-json|createSurveyByText|textToSurvey|create_survey_by_text|create_survey(?!_by_json)|\bcreateSurvey(?!ByJson)\b/;
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
for (const required of ["preview-url", "count_responses", "build_submit_template", "decode_push_payload", "decodePushPayload"]) {
  if (!combined.includes(required)) failures.push(`active documentation is missing required capability name: ${required}`);
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
