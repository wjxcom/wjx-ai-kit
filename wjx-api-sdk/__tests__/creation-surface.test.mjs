import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("SDK exposes only the JSONL survey creation entry point", async () => {
  const sdk = await import("../dist/index.js");

  assert.equal(typeof sdk.createSurveyByJson, "function");
  for (const removed of [
    "createSurvey",
    "createSurveyByText",
    "textToSurvey",
    "parsedQuestionsToWire",
    "LABEL_TO_TYPE",
    "TYPE_MAP",
    "QTYPE_MAP",
  ]) {
    assert.equal(Object.hasOwn(sdk, removed), false, `${removed} must not be exported`);
  }
});

test("SDK source does not retain the removed JSON-array wire conversion chain", async () => {
  const source = await readFile(resolve(__dirname, "../src/modules/survey/json-to-survey.ts"), "utf8");
  for (const removed of [
    "jsonQuestionsToWire",
    "JsonWireConversionResult",
    "WireQuestion",
    "normalizeSpecTableSchema",
    "buildTableSchemaColumns",
    "applyQuestionModes",
  ]) {
    assert.equal(source.includes(removed), false, `${removed} must be removed from the JSONL-only SDK`);
  }
});
