import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSurveyByWjxDsl,
  generateWjxDsl,
  normalizeWjxDsl,
  queryWjxDsl,
  updateWjxDsl,
} from "../dist/index.js";

const DSL = 'wjx-dsl 1; questionnaire { attr "Title" = "测试问卷"; };';

function mockFetch(calls) {
  return async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers });
    return new Response(JSON.stringify({ result: true, data: { dsl: DSL } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

test("generateWjxDsl validates and normalizes AI-generated DSL", () => {
  const result = generateWjxDsl(`\uFEFF${DSL.replaceAll("; ", ";\r\n")}`);
  assert.equal(result.valid, true);
  assert.equal(result.dsl.startsWith("wjx-dsl 1;"), true);
  assert.equal(result.diagnostics.length, 0);
});

test("generateWjxDsl normalizes legacy gap-fill markers and catches backend shape rules", () => {
  const normalized = generateWjxDsl('wjx-dsl 1; questionnaire { question gapfill { attr "Topic" = "1"; attr "Title" = "A {_} B {_}"; attr "GapCount" = "2"; row { }; row { }; }; };');
  assert.equal(normalized.valid, true);
  assert.match(normalized.dsl, /A ___ B ___/);

  const tableNumber = generateWjxDsl('wjx-dsl 1; questionnaire { question matrix { attr "Topic" = "1"; attr "Mode" = "301"; row { }; column { }; }; };');
  assert.equal(tableNumber.valid, false);
  assert.equal(tableNumber.diagnostics.some((item) => item.code === "DSL_MATRIX_RANGE"), true);

  const conjoint = generateWjxDsl('wjx-dsl 1; questionnaire { node "Question" { attr "Type" = "matrix"; attr "Topic" = "1"; attr "Mode" = "302"; attr "Verify" = "conjoint"; }; };');
  assert.equal(conjoint.valid, false);
  assert.equal(conjoint.diagnostics.some((item) => item.code === "DSL_CONJOINT_TASK"), true);
});

test("generateWjxDsl validates file upload MaxSize before transport", () => {
  const valid = `wjx-dsl 1; questionnaire { node "Question" { attr "Type" = "fileupload"; attr "Topic" = "1"; attr "MaxSize" = "2048000"; }; };`;
  assert.equal(generateWjxDsl(valid).valid, true);

  for (const value of [undefined, "0", "-1", "2048001", "1.5", "abc"]) {
    const attr = value === undefined ? "" : ` attr \"MaxSize\" = \"${value}\";`;
    const result = generateWjxDsl(`wjx-dsl 1; questionnaire { node "Question" { attr "Type" = "fileupload"; attr "Topic" = "1";${attr} }; };`);
    assert.equal(result.valid, false, `MaxSize=${value ?? "missing"} was accepted`);
    assert.equal(result.diagnostics.some((item) => item.code === "DSL_FILE_LIMIT"), true);
  }

  assert.equal(generateWjxDsl('wjx-dsl 1; questionnaire { question signature { attr "Topic" = "1"; }; };').valid, true);
});

test("generateWjxDsl rejects blocks without the required terminating semicolon", () => {
  const dsl = `wjx-dsl 1; questionnaire {
    question radio { attr "Topic" = "1"; item { attr "ItemTitle" = "是"; } }
  };`;
  const result = generateWjxDsl(dsl);
  assert.equal(result.valid, false);
  assert.equal(result.diagnostics.some((item) => item.code === "DSL_SEMICOLON"), true);
});

test("generateWjxDsl ignores block-shaped text inside quoted attributes", () => {
  const dsl = `wjx-dsl 1; questionnaire {
    question radio { attr "Topic" = "1"; attr "Title" = "文本包含 item { fake }"; };
  };`;
  const result = generateWjxDsl(dsl);
  assert.equal(result.valid, false);
  assert.equal(result.diagnostics.some((item) => item.code === "DSL_QUESTION_SHAPE"), true);
});

test("generateWjxDsl ignores braces inside comments", () => {
  const dsl = `wjx-dsl 1; questionnaire {
    // comment with { a fake block };
    question radio { attr "Topic" = "1"; item { attr "ItemTitle" = "是"; }; };
  };`;
  const result = generateWjxDsl(dsl);
  assert.equal(result.valid, true);
});

test("generateWjxDsl ignores quotes inside comments", () => {
  const dsl = `wjx-dsl 1; questionnaire {
    // comment with an unmatched quote ";
    question radio { attr "Topic" = "1"; item { attr "ItemTitle" = "是"; }; };
  };`;
  const result = generateWjxDsl(dsl);
  assert.equal(result.valid, true);
});

test("normalizeWjxDsl limits legacy marker replacement to gapfill titles", () => {
  const input = 'wjx-dsl 1; questionnaire { attr "Title" = "literal {_}"; question gapfill { attr "Title" = "A {_}"; raw "Note" = "literal {_}"; }; };';
  const result = normalizeWjxDsl(input);
  assert.equal(result.includes('attr "Title" = "literal {_}";'), true);
  assert.equal(result.includes('attr "Title" = "A ___";'), true);
  assert.equal(result.includes('raw "Note" = "literal {_}";'), true);
});

test("normalizeWjxDsl handles generic gapfill nodes", () => {
  const input = 'wjx-dsl 1; questionnaire { node "Question" { attr "Type" = "gapfill"; attr "Title" = "A {_}"; }; };';
  assert.equal(normalizeWjxDsl(input).includes('attr "Title" = "A ___";'), true);
});

test("generateWjxDsl does not mistake commented or quoted text for the root block", () => {
  const cases = [
    'wjx-dsl 1; // questionnaire { fake };',
    'wjx-dsl 1; attr "Title" = "questionnaire { fake }";',
  ];
  for (const dsl of cases) {
    const result = generateWjxDsl(dsl);
    assert.equal(result.valid, false);
    assert.equal(result.diagnostics.some((item) => item.code === "DSL_ROOT"), true, dsl);
  }
});

test("generateWjxDsl rejects an unterminated block comment", () => {
  const result = generateWjxDsl('wjx-dsl 1; questionnaire { /* unterminated');
  assert.equal(result.valid, false);
  assert.equal(result.diagnostics.some((item) => item.code === "DSL_COMMENT"), true);
});

test("generateWjxDsl accepts hash line comments containing comment markers", () => {
  const result = generateWjxDsl('wjx-dsl 1; questionnaire { # comment /* marker\n };');
  assert.equal(result.valid, true);
});

test("generateWjxDsl requires questionnaire to be the top-level root", () => {
  const result = generateWjxDsl('wjx-dsl 1; wrapper { questionnaire { }; };');
  assert.equal(result.valid, false);
  assert.equal(result.diagnostics.some((item) => item.code === "DSL_ROOT"), true);
});

test("generateWjxDsl rejects multiple questionnaire roots", () => {
  const result = generateWjxDsl('wjx-dsl 1; questionnaire { }; questionnaire { };');
  assert.equal(result.valid, false);
  assert.equal(result.diagnostics.some((item) => item.code === "DSL_ROOT"), true);
});

test("generateWjxDsl requires gap-fill placeholders to match GapCount", () => {
  const result = generateWjxDsl('wjx-dsl 1; questionnaire { question gapfill { attr "Topic" = "1"; attr "Title" = "A ___"; attr "GapCount" = "2"; row { }; row { }; }; };');
  assert.equal(result.valid, false);
  assert.equal(result.diagnostics.some((item) => item.code === "DSL_QUESTION_SHAPE"), true);
});

test("DSL clients route the three actions and do not send CAS fields", async () => {
  const calls = [];
  const credentials = { apiKey: "dsl-test-key", baseUrl: "https://example.test" };
  await queryWjxDsl({ vid: "207550" }, credentials, mockFetch(calls));
  const nonCanonicalDsl = `\uFEFF${DSL.replaceAll("; ", ";\r\n")}`;
  const normalizedDsl = nonCanonicalDsl.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  await createSurveyByWjxDsl({ dsl: nonCanonicalDsl }, credentials, mockFetch(calls));
  await updateWjxDsl({ vid: "207550", dsl: nonCanonicalDsl, allowBreakingChanges: true }, credentials, mockFetch(calls));
  assert.deepEqual(calls.map((call) => call.body.action), ["1000006", "1000109", "1000110"]);
  assert.equal(calls[1].body.dsl, normalizedDsl);
  assert.equal(calls[2].body.dsl, normalizedDsl);
  assert.equal(calls[2].body.vid, "207550");
  assert.equal(calls[2].body.allow_breaking_changes, true);
  assert.equal("allowBreakingChanges" in calls[2].body, false);
  assert.equal("ifMatch" in calls[2].body, false);
  assert.equal("receipt" in calls[2].body, false);
  assert.equal("idempotencyKey" in calls[2].body, false);
});

test("invalid DSL is rejected before a write request", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; throw new Error("must not call transport"); };
  await assert.rejects(() => createSurveyByWjxDsl({ dsl: "invalid" }, { apiKey: "key" }, fetchImpl), /wjx-dsl|questionnaire/);
  await assert.rejects(() => updateWjxDsl({ vid: "1", dsl: "invalid" }, { apiKey: "key" }, fetchImpl), /wjx-dsl|questionnaire/);
  assert.equal(called, false);
});

test("DSL create rejects unsupported survey atypes before transport", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; throw new Error("must not call transport"); };
  for (const atype of [0, 8, 12, 999]) {
    await assert.rejects(
      () => createSurveyByWjxDsl({ dsl: DSL, atype }, { apiKey: "key" }, fetchImpl),
      /不支持创建 atype/,
      `atype=${atype} was accepted`,
    );
  }
  assert.equal(called, false);
});
