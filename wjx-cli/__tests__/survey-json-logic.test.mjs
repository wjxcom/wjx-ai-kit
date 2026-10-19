import assert from "node:assert/strict";
import { test } from "node:test";
import { startFixture } from "./fixtures/http-fixture.mjs";

const dsl = { logic: 'logic { if "2::1" then show "3"; };' };
const jsonl = '{"qtype":"问卷基础信息","title":"逻辑测试"}\n{"qtype":"单选","title":"您的选择","select":["是","否"]}';
test("create 和 update dry-run 透传逻辑对象且不发送 HTTP", async () => {
  const fixture = await startFixture({ env: { WJX_API_KEY: "fixture-key" } });
  try {
    const created = await fixture.run(["--dry-run", "survey", "create", "--jsonl", jsonl, "--dsl", JSON.stringify(dsl)]);
    assert.equal(created.exitCode, 0, created.stderr);
    const body = JSON.parse(JSON.parse(created.stdout).data.plans[0].body);
    assert.deepEqual(body.dsl, dsl);
    const updated = await fixture.run(["--stdin", "--dry-run", "survey", "update"], { input: JSON.stringify({ vid: 42, dsl }) });
    assert.equal(updated.exitCode, 0, updated.stderr);
    const updateBody = JSON.parse(JSON.parse(updated.stdout).data.plans[0].body);
    assert.equal(updateBody.action, "1000109");
    assert.deepEqual(updateBody.dsl, dsl);
    assert.equal(Object.hasOwn(updateBody, "surveydatajson"), false);
    assert.equal(Object.hasOwn(updateBody, "publish"), false);
    assert.equal(fixture.requests().length, 0);
  } finally { await fixture.close(); }
});
test("旧独立 DSL 命令不存在，JSON 修改拒绝缺少输入", async () => {
  const fixture = await startFixture({ env: { WJX_API_KEY: "fixture-key" } });
  try {
    const removed = await fixture.run(["dsl", "query", "--vid", "42"]);
    assert.equal(removed.exitCode, 2);
    const empty = await fixture.run(["--dry-run", "survey", "update", "--vid", "42"]);
    assert.equal(empty.exitCode, 2, empty.stderr);
    assert.equal(fixture.requests().length, 0);
  } finally { await fixture.close(); }
});
