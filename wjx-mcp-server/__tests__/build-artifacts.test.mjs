import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distRoot = join(projectRoot, "dist");

test("MCP dist does not retain removed survey-generation prompt artifacts", () => {
  const promptDir = join(distRoot, "prompts");
  assert.ok(!existsSync(join(promptDir, "survey-generation.js")));
  assert.ok(!existsSync(join(promptDir, "survey-generation.d.ts")));
  assert.ok(!existsSync(join(promptDir, "survey-generation.js.map")));

  const staleReferences = [];
  for (const file of readdirSync(distRoot, { recursive: true })) {
    if (!String(file).endsWith(".js") && !String(file).endsWith(".d.ts")) continue;
    const path = join(distRoot, file);
    const text = readFileSync(path, "utf8");
    if (text.includes("create_survey_by_text") || text.includes("createSurveyByText")) {
      staleReferences.push(String(file));
    }
  }
  assert.deepEqual(staleReferences, []);
});
