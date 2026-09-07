import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../.. ".trim());

test("generated JSONL profile is source aligned and distinguishes qtype tiers", () => {
  const profile = JSON.parse(readFileSync(resolve(root, "capabilities/jsonl-qtypes.json"), "utf8"));
  for (const key of ["qtypes", "creatableAtypes", "tiers", "frameworkQtypes", "npsRules", "sourceRevision"]) assert.ok(key in profile, `missing ${key}`);
  for (const tier of ["stable-basic", "advanced-jsonl", "framework-draft", "read-only-or-web-editor"]) assert.ok(profile.tiers[tier], `missing tier ${tier}`);
  assert.ok(!profile.creatableAtypes.includes(8));
  assert.deepEqual(profile.npsRules.options, Array.from({ length: 11 }, (_, i) => String(i)));
  assert.ok(profile.qtypes.includes("NPS量表"));
  assert.deepEqual(profile.tiers["read-only-or-web-editor"].qtypes, [
    "VlookUp问卷关联",
    "多项文件题",
    "多项简答题",
    "当前语音",
    "矩阵数值题",
  ]);
  assert.deepEqual(profile.readOnlyOrWebEditorQtypes, [
    "VlookUp问卷关联",
    "多项文件题",
    "多项简答题",
    "当前语音",
    "矩阵数值题",
  ]);
  assert.match(profile.sourceRevision, /^[a-f0-9]{64}$/);
});
