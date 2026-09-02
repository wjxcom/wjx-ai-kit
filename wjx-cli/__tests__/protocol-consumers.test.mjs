import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { scanProtocolConsumers } from "../scripts/lib/protocol-scan.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("active protocol consumers do not teach the legacy result envelope", () => {
  const findings = scanProtocolConsumers(ROOT);
  assert.deepEqual(findings, [], findings.map((item) => `${item.file}:${item.line}`).join("\n"));
});

test("Agent guidance does not recommend removed reference topics", async () => {
  for (const relative of [
    "wjx-agents/wjx-cli-expert/wjx-cli-expert.md",
    ".claude/agents/wjx-cli-expert.md",
    "wjx-cli/bundled/wjx-cli-expert.md",
  ]) {
    const content = await readFile(`${ROOT}/${relative}`, "utf8");
    assert.doesNotMatch(content, /wjx reference dsl/, `${relative} still recommends removed reference dsl topic`);
  }
});
