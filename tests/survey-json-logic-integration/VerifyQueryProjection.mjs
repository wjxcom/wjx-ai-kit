import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { surveyLogicMatches, verifySurveyJsonUpdate } from "../../wjx-api-sdk/dist/index.js";

const outputRoot = process.argv[2];
assert.ok(outputRoot, "需要提供创建集成测试的输出目录");
function query(name) {
  const data = JSON.parse(readFileSync(resolve(outputRoot, `ordinary-query${name}.json`), "utf8").replace(/^\uFEFF/, ""));
  assert.equal(typeof data.dsl?.logic, "string");
  for (const question of data.questions) assert.equal(Object.hasOwn(question, "relation"), false);
  return { ...data, vid: 42, status: 0 };
}
function matches(logic, data) { return surveyLogicMatches(logic, data.dsl.logic, data.questions); }

test("真实 XML 查询投影无 relation 字段，仍能核验条件及 OR 逻辑", () => {
  const data = query("");
  assert.equal(matches('logic { if "2::1" then show "3"; };', data), true);
  assert.equal(matches('logic { if "2::3" or "3::3" or "4::3" then show "5"; };', data), true);
  assert.equal(matches('logic { show "3"; };', data), false);
});

test("清除目标条件后保留其他规则，SDK 可确认显示成功", () => {
  const data = query("-after-clear");
  assert.equal(matches('logic { show "3"; };', data), true);
  assert.equal(matches('logic { if "2::2" then show "4"; };', data), true);
  assert.equal(matches('logic { show "4"; };', data), false);
});

test("没有逻辑及清除最后一条规则时返回明确空投影", () => {
  for (const name of ["-without-logic", "-cleared-last-rule"]) {
    const data = query(name);
    assert.equal(data.dsl.logic, "logic {\n};");
    assert.equal(matches('logic { show "3"; };', data), true);
    assert.equal(matches('logic { hide "3"; };', data), false);
  }
});

test("真实隐藏规则无 relation 查询字段也可核验", () => {
  const data = query("-hidden");
  assert.equal(matches('logic { hide "3"; };', data), true);
  assert.equal(matches('logic { show "3"; };', data), false);
});

test("原生 Relation=0 不会被空投影或 is_hide=false 误判为显示成功", () => {
  const data = query("-zero-hidden");
  assert.equal(matches('logic { show "3"; };', data), false);
  assert.equal(matches('logic { hide "3"; };', data), false);
});

test("SDK 修改读回通过真实查询投影确认清除及隐藏，缺失投影保留未知结果", async () => {
  const before = query("");
  const credentials = { apiKey: "fixture-key", baseUrl: "https://fixture.test" };
  const verify = (logic, saved) => verifySurveyJsonUpdate({ vid: 42, dsl: { logic } }, before, credentials,
    async () => new Response(JSON.stringify({ result: true, data: saved }), { headers: { "content-type": "application/json" } }));
  assert.equal((await verify('logic { show "3"; };', query("-cleared-last-rule"))).outcome, "verified");
  assert.equal((await verify('logic { hide "3"; };', query("-hidden"))).outcome, "verified");
  assert.equal((await verify('logic { show "3"; };', before)).outcome, "unknown");
  const missing = query("-cleared-last-rule");
  delete missing.dsl;
  assert.equal((await verify('logic { show "3"; };', missing)).outcome, "unknown");
});
