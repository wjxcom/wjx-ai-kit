import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSurveyByWjxDsl,
  generateWjxDsl,
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

test("DSL clients route the three actions and do not send CAS fields", async () => {
  const calls = [];
  const credentials = { apiKey: "dsl-test-key", baseUrl: "https://example.test" };
  await queryWjxDsl({ vid: "207550" }, credentials, mockFetch(calls));
  const nonCanonicalDsl = `\uFEFF${DSL.replaceAll("; ", ";\r\n")}`;
  const normalizedDsl = nonCanonicalDsl.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  await createSurveyByWjxDsl({ dsl: nonCanonicalDsl }, credentials, mockFetch(calls));
  await updateWjxDsl({ vid: "207550", dsl: nonCanonicalDsl }, credentials, mockFetch(calls));
  assert.deepEqual(calls.map((call) => call.body.action), ["1000006", "1000109", "1000110"]);
  assert.equal(calls[1].body.dsl, normalizedDsl);
  assert.equal(calls[2].body.dsl, normalizedDsl);
  assert.equal(calls[2].body.vid, "207550");
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
