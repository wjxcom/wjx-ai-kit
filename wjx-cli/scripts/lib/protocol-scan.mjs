import { readFileSync } from "node:fs";

export const PROTOCOL_CONSUMERS = [
  "wjx-skills/wjx-cli-use/SKILL.md",
  "wjx-skills/wjx-cli-use/references/response-commands.md",
  "wjx-skills/wjx-cli-use/references/survey-commands.md",
  "wjx-skills/wjx-survey-ppt/SKILL.md",
  "wjx-agents/wjx-cli-expert/wjx-cli-expert.md",
  ".claude/agents/wjx-cli-expert.md",
  "wjx-docs/reference/cli.md",
  "wjx-docs/start/cli.md",
  "wjx-docs/migration.md",
];

const LEGACY_ALLOWED = /迁移前|旧版本|legacy|before migration/i;

export function scanProtocolConsumers(root) {
  const findings = [];
  for (const relative of PROTOCOL_CONSUMERS) {
    let text;
    try { text = readFileSync(`${root}/${relative}`, "utf8"); } catch { continue; }
    text.split(/\r?\n/).forEach((line, index) => {
      if (/"result"\s*:\s*(true|false)/.test(line) && !LEGACY_ALLOWED.test(line)) {
        findings.push({ file: relative, line: index + 1, reason: "active consumer uses legacy result field" });
      }
    });
  }
  return findings;
}
