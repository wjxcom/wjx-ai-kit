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

for (const operation of ["show", "hide"]) test(`CLI 创建及仅逻辑修改 ${operation} 不依赖查询 relation 字段`, async () => {
  const inputDsl = { logic: `logic { ${operation} "3"; };` };
  const savedLogic = operation === "show" ? "logic {\n};" : inputDsl.logic;
  let logic = savedLogic;
  const fixture = await startFixture({
    env: { WJX_API_KEY: "fixture-key" },
    response: ({ request }) => {
      const body = JSON.parse(request.body);
      if (["1000106", "1000109"].includes(body.action)) {
        logic = savedLogic;
        return { result: true, data: { vid: 42 } };
      }
      return { result: true, data: {
        vid: 42, title: "逻辑测试", atype: 1, status: 0,
        sid: "logicSid", fill_url: `http://${request.headers.host}/vm/logicSid.aspx`,
        questions: [{ q_index: 3, q_type: 3, q_subtype: 3, q_title: "您的选择", is_requir: true,
          is_hide: logic.includes('hide "3"'),
          items: [{ item_title: "是" }, { item_title: "否" }] }],
        dsl: { logic },
      } };
    },
  });
  try {
    const created = await fixture.run(["--stdin", "survey", "create"], {
      input: JSON.stringify({ jsonl, dsl: inputDsl, publish: false }),
    });
    assert.equal(created.exitCode, 0, created.stderr);
    assert.equal(JSON.parse(created.stdout).data.verification.structure, true);
    const beforeUpdate = fixture.requests().length;
    assert.deepEqual(fixture.requests().map(request => JSON.parse(request.body).action), ["1000106", "1000001"]);
    logic = 'logic { if "2::1" then show "3"; };';
    const updated = await fixture.run(["--yes", "survey", "update", "--vid", "42", "--dsl", JSON.stringify(inputDsl)]);
    assert.equal(updated.exitCode, 0, updated.stderr);
    const output = JSON.parse(updated.stdout).data;
    assert.equal(output.verification.structure, true);
    assert.equal(output.outcome, "verified");
    assert.deepEqual(fixture.requests().slice(beforeUpdate).map(request => JSON.parse(request.body).action), ["1000001", "1000109", "1000001"]);
  } finally { await fixture.close(); }
});
