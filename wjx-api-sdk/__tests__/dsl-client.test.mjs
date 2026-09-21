import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSurveyByWjxDsl,
  generateWjxDsl,
  queryWjxDsl,
  updateWjxDsl,
  verifyWjxDslWrite,
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

test("generateWjxDsl accepts query-style matrix children and protocol matrices", () => {
  const queryStyle = `wjx-dsl 1; questionnaire {
    node "Question" { attr "Type" = "matrix"; attr "Topic" = "1"; attr "Mode" = "201";
      node "ItemRow" { attr "Title" = "Row"; };
    };
    node "Question" { attr "Type" = "matrix"; attr "Topic" = "2"; attr "Mode" = "302";
      attr "Verify" = "test"; attr "TestData" = "{}";
    };
    node "Question" { attr "Type" = "matrix"; attr "Topic" = "3"; attr "Mode" = "201";
      attr "Verify" = "aiInterview";
    };
    node "Question" { attr "Type" = "matrix"; attr "Topic" = "4"; attr "Mode" = "302";
      attr "Verify" = "circulate"; attr "CirculateRounds" = "2"; attr "CirculateObjects" = "员工、主管";
    };
  };`;
  const result = generateWjxDsl(queryStyle);
  assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
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

test("verifyWjxDslWrite reads back identity, DSL structure, status, and link", async () => {
  const dsl = 'wjx-dsl 1; questionnaire { attr "Title" = "验证问卷"; question radio { attr "Topic" = "1"; attr "Title" = "题目"; item { attr "ItemTitle" = "是"; attr "ItemValue" = "1"; }; }; };';
  const fetchImpl = async (_url, _init) => new Response(JSON.stringify({
    result: true,
    data: { vid: 42, dsl, status: 0, sid: "AbC123" },
  }), { status: 200, headers: { "content-type": "application/json" } });
  const verified = await verifyWjxDslWrite({ vid: 42, expectedDsl: dsl, credentials: { apiKey: "key", baseUrl: "https://example.test" }, fetchImpl });
  assert.equal(verified.outcome, "verified");
  assert.deepEqual(verified.verification, { structure: true, status: true, link: true });
});

test("DSL draft read-back does not require a respondent link", async () => {
  const dsl = 'wjx-dsl 1; questionnaire { attr "Title" = "草稿"; };';
  const verified = await verifyWjxDslWrite({
    vid: 42,
    expectedDsl: dsl,
    credentials: { apiKey: "key" },
    fetchImpl: async () => new Response(JSON.stringify({ result: true, data: { vid: 42, dsl, status: 0 } }), { headers: { "content-type": "application/json" } }),
  });
  assert.equal(verified.outcome, "verified");
  assert.deepEqual(verified.verification, { structure: true, status: true, link: true });
});

test("DSL read-back detects changed question settings and options under the same Topic", async () => {
  const expected = `wjx-dsl 1; questionnaire {
    attr "Title" = "比例题";
    question matrix { attr "Topic" = "1"; attr "Title" = "分配比例"; attr "Total" = "100";
      row { attr "Title" = "食堂"; };
      row { attr "Title" = "咖啡厅"; };
    };
  };`;
  const actual = expected.replace('attr "Total" = "100"', 'attr "Total" = "0"');
  const fetchImpl = async () => new Response(JSON.stringify({
    result: true, data: { vid: 42, dsl: actual, status: 0, sid: "shortId" },
  }), { headers: { "content-type": "application/json" } });
  const result = await verifyWjxDslWrite({ vid: 42, expectedDsl: expected, credentials: { apiKey: "key" }, fetchImpl });
  assert.equal(result.outcome, "unknown");
  assert.equal(result.verification.structure, false);
  assert.match(result.warnings.join(" "), /attribute|row|option/);

  const missingRow = expected.replace('row { attr "Title" = "咖啡厅"; };', "");
  const rowResult = await verifyWjxDslWrite({
    vid: 42, expectedDsl: expected, credentials: { apiKey: "key" },
    fetchImpl: async () => new Response(JSON.stringify({ result: true, data: { vid: 42, dsl: missingRow, status: 0, sid: "shortId" } }), { headers: { "content-type": "application/json" } }),
  });
  assert.equal(rowResult.verification.structure, false);

  const reordered = expected
    .replace('row { attr "Title" = "食堂"; };', 'row { attr "Title" = "占位"; };')
    .replace('row { attr "Title" = "咖啡厅"; };', 'row { attr "Title" = "食堂"; };')
    .replace('row { attr "Title" = "占位"; };', 'row { attr "Title" = "咖啡厅"; };');
  const orderResult = await verifyWjxDslWrite({
    vid: 42, expectedDsl: expected, credentials: { apiKey: "key" },
    fetchImpl: async () => new Response(JSON.stringify({ result: true, data: { vid: 42, dsl: reordered, status: 0, sid: "shortId" } }), { headers: { "content-type": "application/json" } }),
  });
  assert.equal(orderResult.verification.structure, false);
});

test("DSL read-back rejects a file upload downgraded to a text question", async () => {
  const expected = 'wjx-dsl 1; questionnaire { attr "Title" = "文件调查"; question fileupload { attr "Topic" = "1"; attr "Title" = "请上传文件"; attr "MaxSize" = "1024"; }; };';
  const actual = expected.replace("question fileupload", "question question");
  const result = await verifyWjxDslWrite({
    vid: 42, expectedDsl: expected, credentials: { apiKey: "key" },
    fetchImpl: async () => new Response(JSON.stringify({ result: true, data: { vid: 42, dsl: actual, status: 0, sid: "shortId" } }), { headers: { "content-type": "application/json" } }),
  });
  assert.equal(result.verification.structure, false);
  assert.equal(result.outcome, "unknown");
});

test("DSL read-back permits server-owned defaults while preserving explicit content", async () => {
  const expected = `wjx-dsl 1; questionnaire {
    attr "Title" = "问卷";
    question radio { attr "Topic" = "1"; attr "Title" = "选择";
      item { attr "ItemTitle" = "是"; attr "ItemValue" = "1"; };
    };
  };`;
  const actual = expected.replace('attr "ItemValue" = "1";', 'attr "ItemValue" = "1"; attr "IsShow" = "true";');
  const result = await verifyWjxDslWrite({
    vid: 42, expectedDsl: expected, credentials: { apiKey: "key" },
    fetchImpl: async () => new Response(JSON.stringify({ result: true, data: { vid: 42, dsl: actual, status: 0, sid: "shortId" } }), { headers: { "content-type": "application/json" } }),
  });
  assert.equal(result.outcome, "verified", result.warnings.join("; "));
});

test("DSL verification ignores keywords inside quoted titles and comments", async () => {
  const dsl = `wjx-dsl 1; questionnaire {
    attr "Title" = "问卷";
    // question radio { attr "Topic" = "99"; }
    question question { attr "Topic" = "1"; attr "Title" = "请描述 question radio { item { 的含义";
      attr "Verify" = "不验证";
    };
  };`;
  const result = await verifyWjxDslWrite({
    vid: 42, expectedDsl: dsl, credentials: { apiKey: "key" },
    fetchImpl: async () => new Response(JSON.stringify({ result: true, data: { vid: 42, dsl, status: 0, sid: "shortId" } }), { headers: { "content-type": "application/json" } }),
  });
  assert.equal(result.outcome, "verified", result.warnings.join("; "));
  assert.equal(result.actualQuestionCount, 1);
});

test("local DSL validation normalizes aliases and rejects duplicate Topics", () => {
  const duplicate = generateWjxDsl(`wjx-dsl 1; questionnaire {
    question matrix_single { attr "Topic" = "1"; attr "Title" = "A"; row { }; item { }; };
    question matrix_multi { attr "Topic" = "1"; attr "Title" = "B"; row { }; item { }; };
  };`);
  assert.equal(duplicate.valid, false);
  assert.ok(duplicate.diagnostics.some((item) => item.code === "DSL_DUPLICATE_TOPIC"));
});
