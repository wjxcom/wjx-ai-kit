#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = ["wjx-api-sdk/src/modules/survey/json-to-survey.ts", "wjx-api-sdk/src/modules/survey/client.ts", "wjx-api-sdk/package.json"];
const stableSort = (items) => [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
function revision() {
  const hash = createHash("sha256");
  for (const relative of sourceFiles) hash.update(`${relative}\n${readFileSync(resolve(root, relative), "utf8").replace(/\r\n/g, "\n")}\n`);
  return hash.digest("hex");
}

export async function createProfile() {
  const sdk = await import(pathToFileURL(resolve(root, "wjx-api-sdk/dist/index.js")));
  const qtypes = stableSort(sdk.JSONL_SUPPORTED_QTYPES);
  const frameworkQtypes = stableSort(sdk.FRAMEWORK_ONLY_JSONL_QTYPES);
  const frameworkSet = new Set(frameworkQtypes);
  const readOnlyQtypes = stableSort(sdk.JSONL_READ_ONLY_OR_WEB_EDITOR_QTYPES ?? []);
  const readOnlySet = new Set(readOnlyQtypes);
  const stableNames = new Set(["单选", "多选", "单项填空", "多项填空", "简答题", "量表题", "NPS量表", "矩阵单选", "矩阵多选", "矩阵量表", "判断题", "下拉框", "排序"]);
  const stable = qtypes.filter((name) => stableNames.has(name));
  const advanced = qtypes.filter((name) => !frameworkSet.has(name) && !stableNames.has(name) && !readOnlySet.has(name));
  return {
    schemaVersion: 1,
    sourceRevision: revision(),
    qtypes,
    creatableAtypes: [...sdk.CREATABLE_SURVEY_ATYPES].sort((a, b) => a - b),
    tiers: {
      "stable-basic": { qtypes: stable, mode: "create-and-publish", description: "常用 JSONL 题型，当前 SDK 可直接创建。" },
      "advanced-jsonl": { qtypes: advanced, mode: "create-after-validation", description: "SDK 支持但字段约束更复杂，创建前必须完成 JSONL 预检。" },
      "framework-draft": { qtypes: frameworkQtypes, mode: "draft-unless-explicit-publish", description: "框架壳题型；默认创建草稿，需编辑器或补充资源。" },
      "read-only-or-web-editor": { qtypes: readOnlyQtypes, mode: "read-only-or-web-editor", description: "当前创建接口明确拒绝；需要读取既有问卷或 Web 编辑器。" },
    },
    frameworkQtypes,
    readOnlyOrWebEditorQtypes: readOnlyQtypes,
    npsRules: { qtype: "NPS量表", options: Array.from({ length: 11 }, (_, i) => String(i)), validRange: [0, 10], valuesAreStrings: true },
    csatRules: { fivePoint: [1, 5], sevenPoint: [1, 7], valuesMustBeIntegers: true },
  };
}

export function renderMcpResource(profile) {
  return `export const JSONL_QTYPES_RESOURCE = ${JSON.stringify(profile, null, 2)} as const;\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const profile = await createProfile();
  const json = `${JSON.stringify(profile, null, 2)}\n`;
  const resource = renderMcpResource(profile);
  const jsonPath = resolve(root, "capabilities/jsonl-qtypes.json");
  const resourcePath = resolve(root, "wjx-mcp-server/src/resources/jsonl-qtypes.ts");
  if (process.argv.includes("--check")) {
    if (readFileSync(jsonPath, "utf8") !== json || readFileSync(resourcePath, "utf8") !== resource) {
      console.error("JSONL capability artifacts drift detected; run npm run jsonl-capabilities:export");
      process.exit(1);
    }
  } else {
    writeFileSync(jsonPath, json, "utf8");
    writeFileSync(resourcePath, resource, "utf8");
  }
}
