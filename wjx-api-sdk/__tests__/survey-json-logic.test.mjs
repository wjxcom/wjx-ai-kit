import assert from "node:assert/strict";
import { test } from "node:test";
import * as sdk from "../dist/index.js";

const jsonl = '{"qtype":"问卷基础信息","title":"逻辑问卷","atype":1}\n{"qtype":"单选","title":"是否使用","select":["是","否"],"relation":"旧条件"}';
const dsl = { logic: 'logic { if "2::1" then show "3"; };' };
const credentials = { apiKey: "fixture-key", baseUrl: "https://fixture.test" };
function transport(calls, data = {}) { return async (_url, init) => {
  calls.push(JSON.parse(init.body));
  return new Response(JSON.stringify({ result: true, data }), { headers: { "content-type": "application/json" } });
}; }

test("创建维持 JSONL 内容，DSL 作为对象提交且保留 JSON 逻辑字段", async () => {
  const calls = [];
  await sdk.createSurveyByJson({ jsonl, dsl }, credentials, transport(calls));
  assert.equal(calls[0].action, "1000106");
  assert.deepEqual(calls[0].dsl, dsl);
  assert.equal(JSON.parse(calls[0].surveydatajson.split("\n")[1]).relation, "旧条件");
  await sdk.createSurveyByJson({ jsonl }, credentials, transport(calls));
  assert.equal(Object.hasOwn(calls[1], "dsl"), false);
});

test("仅修改逻辑时不附带题目 JSON 或隐式发布、类型参数", async () => {
  const calls = [];
  await sdk.updateSurveyByJson({ vid: 42, dsl }, credentials, transport(calls));
  assert.deepEqual(calls[0], { action: "1000109", vid: 42, dsl });
});

test("JSON 内容修改使用指定 action，并传递答卷保护选项", async () => {
  const calls = [];
  await sdk.updateSurveyByJson({ vid: "42", jsonl, dsl, allowBreakingChanges: true, publish: false }, credentials, transport(calls));
  assert.equal(calls[0].action, "1000109");
  assert.match(calls[0].surveydatajson, /逻辑问卷/);
  assert.equal(calls[0].allowBreakingChanges, true);
  assert.equal(calls[0].publish, false);
});

test("缺少内容、非法编号、空模块和完整 DSL 在发请求前被拒绝", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw Error("不应执行网络"); };
  for (const input of [{ vid: 42 }, { vid: "sid", dsl }, { vid: 42, dsl: "logic {};" },
    { vid: 42, dsl: { logic: "" } }, { vid: 42, dsl: { logic: "wjx-dsl 1; questionnaire {};" } },
    { vid: 42, dsl: { logic: 'logic { if "2::1" then show "3";' } },
    { vid: 42, dsl: { logic: "logic {}; questionnaire {};" } },
    { vid: 42, dsl: { logic: "logic {};", question: {} } }]) {
    await assert.rejects(() => sdk.updateSurveyByJson(input, credentials, fetchImpl));
  }
  assert.equal(calls, 0);
});

test("更新写入即使调用方提供重试参数也只提交一次", async () => {
  let calls = 0;
  await assert.rejects(() => sdk.updateSurveyByJson({ vid: 42, dsl }, credentials, async () => {
    calls++; throw new TypeError("fetch failed");
  }, { maxRetries: 3, retryBudget: 3 }), /unknown/);
  assert.equal(calls, 1);
});

test("从普通查询返回 XML 逻辑投影；没有投影时不能伪称更新验证通过", async () => {
  const before = { vid: 42, title: "问卷", status: 0, questions: [] };
  const input = { vid: 42, dsl };
  const missing = await sdk.verifySurveyJsonUpdate(input, before, credentials, transport([], before));
  assert.equal(missing.outcome, "unknown");
  const verified = await sdk.verifySurveyJsonUpdate(input, before, credentials, transport([], { ...before, dsl }));
  assert.equal(verified.outcome, "verified");
});

test("逻辑比较保留字符串中的空格，忽略规则排列和格式", () => {
  assert.equal(sdk.surveyLogicMatches('logic { if "2::1" then show "3"; hide "4"; };', 'logic {hide "4";\nif "2::1" then show "3";};',
    [{ q_index: 4, q_type: 3, relation: "-1", is_hide: true }]), true);
  assert.equal(sdk.surveyLogicMatches('logic { raw attr "Relation" question "3" = "A B"; };', 'logic { raw attr "Relation" question "3" = "AB"; };'), false);
});

test("JSON 修改读回核对题干、选项内容及顺序，不能只凭题型和数量判成功", async () => {
  const content = [
    { qtype: "问卷基础信息", title: "内容核验" },
    { qtype: "分页栏" },
    { qtype: "单选", title: "新题干 A B", select: ["新选项 A", "新选项 B"] },
  ].map(JSON.stringify).join("\n");
  const saved = { vid: 42, title: "内容核验", status: 0, questions: [
    { q_index: 1, q_type: 1, q_subtype: 1 },
    { q_index: 7, q_type: 3, q_subtype: 3, q_title: "新题干 A B", is_requir: true,
      items: [{ item_title: "新选项 A" }, { item_title: "新选项 B" }] },
  ] };
  const input = { vid: 42, jsonl: content };
  const good = await sdk.verifySurveyJsonUpdate(input, {}, credentials, transport([], saved));
  assert.equal(good.outcome, "verified");
  for (const mutate of [
    question => { question.q_title = "旧题干"; },
    question => { question.q_title = "新题干 AB"; },
    question => { question.items[0].item_title = "旧选项"; },
    question => { question.items.reverse(); },
    question => { delete question.items; },
    question => { question.is_requir = false; },
  ]) {
    const stale = structuredClone(saved); mutate(stale.questions[1]);
    const result = await sdk.verifySurveyJsonUpdate(input, {}, credentials, transport([], stale));
    assert.equal(result.outcome, "unknown", JSON.stringify(stale));
    assert.ok(result.warnings.length);
  }
});

test("JSON 修改带有无法完整读回的高级字段时明确保留未知结果", async () => {
  const content = [
    { qtype: "问卷基础信息", title: "高级设置核验" },
    { qtype: "单选", title: "选择", select: ["A", "B"], lowlimit: 1 },
  ].map(JSON.stringify).join("\n");
  const saved = { vid: 42, title: "高级设置核验", status: 0, questions: [
    { q_index: 2, q_type: 3, q_subtype: 3, q_title: "选择", is_requir: true,
      items: [{ item_title: "A" }, { item_title: "B" }] },
  ] };
  const result = await sdk.verifySurveyJsonUpdate({ vid: 42, jsonl: content }, {}, credentials, transport([], saved));
  assert.equal(result.outcome, "unknown");
  assert.match(result.warnings.join("\n"), /lowlimit/);
});

test("无条件 show 只在真实题目明确清除 Relation 且无冲突投影时通过", () => {
  const logic = 'logic { show "3"; };';
  assert.equal(sdk.surveyLogicMatches(logic, undefined, [{ q_index: 3, q_type: 3, relation: "" }]), true);
  assert.equal(sdk.surveyLogicMatches(logic, undefined, [{ q_index: 3, q_type: 3, relation: "0" }]), false);
  assert.equal(sdk.surveyLogicMatches(logic, undefined, [{ q_index: 3, q_type: 3, relation: 0 }]), false);
  for (const questions of [[], [{ q_index: 2, q_type: 3, relation: "" }], [{ q_index: 3, q_type: 3 }],
    [{ q_index: 3, q_type: 3, relation: "2,1" }], [{ q_index: 3, q_type: 3, relation: "-1" }],
    [{ q_index: 3, q_type: 3, relation: "" }, { q_index: 3, q_type: 3, relation: "" }], [{ q_index: 3, q_type: 1, relation: "" }]]) {
    assert.equal(sdk.surveyLogicMatches(logic, undefined, questions), false, JSON.stringify(questions));
  }
  assert.equal(sdk.surveyLogicMatches(logic, 'logic { if "2::1" then show "3"; };', [{ q_index: 3, q_type: 3, relation: "" }]), false);
  assert.equal(sdk.surveyLogicMatches(logic, 'logic { raw attr "Relation" question "3" = "2,1"; };', [{ q_index: 3, q_type: 3, relation: "" }]), false);
  assert.equal(sdk.surveyLogicMatches(logic, logic), false);
  assert.equal(sdk.surveyLogicMatches('logic { show "3"; if "2::1" then show "4"; };', undefined,
    [{ q_index: 3, q_type: 3, relation: "" }, { q_index: 4, q_type: 3, relation: "" }]), false);
});

test("仅逻辑更新成功清除最后一个关联后不要求 XML 投影保留 show 文本", async () => {
  const before = { vid: 42, title: "清除关联", status: 0, questions: [
    { q_index: 3, q_type: 3, q_subtype: 3, q_title: "原有题目", relation: "2,1" },
  ] };
  const saved = structuredClone(before); saved.questions[0].relation = "";
  const input = { vid: 42, dsl: { logic: 'logic { show "3"; };' } };
  const verified = await sdk.verifySurveyJsonUpdate(input, before, credentials, transport([], saved));
  assert.equal(verified.outcome, "verified");
  const stale = await sdk.verifySurveyJsonUpdate(input, before, credentials, transport([], before));
  assert.equal(stale.outcome, "unknown");
  for (const relation of ["0", 0]) {
    const zero = structuredClone(saved); zero.questions[0].relation = relation;
    assert.equal((await sdk.verifySurveyJsonUpdate(input, before, credentials, transport([], zero))).outcome, "unknown");
  }
  const hidden = structuredClone(before); hidden.questions[0].relation = "-1"; hidden.questions[0].is_hide = true;
  const visible = structuredClone(saved); visible.questions[0].is_hide = false;
  assert.equal((await sdk.verifySurveyJsonUpdate(input, hidden, credentials, transport([], visible))).outcome, "verified");
  for (const status of [null, "", false]) {
    const invalid = await sdk.verifySurveyJsonUpdate(input, before, credentials, transport([], { ...saved, status }));
    assert.equal(invalid.outcome, "unknown");
    assert.equal(invalid.verification.status, false);
  }
});

test("仅逻辑更新比较真实查询中的 anytime_jump 时不误当正文变更", async () => {
  const before = { vid: 42, title: "原生逻辑字段", status: 0, questions: [
    { q_index: 2, q_type: 3, q_subtype: 3, q_title: "原有题干",
      items: [{ item_index: 1, item_title: "原有选项" }] },
    { q_index: 7, q_type: 5, q_subtype: 5, q_title: "跳转目标" },
  ] };
  const logic = 'logic { jump from "2" to "7"; };';
  const saved = structuredClone(before);
  saved.questions[0].anytime_jump = 7;
  saved.dsl = { logic };
  const input = { vid: 42, dsl: { logic } };
  assert.equal((await sdk.verifySurveyJsonUpdate(input, before, credentials, transport([], saved))).outcome, "verified");
  saved.questions[0].items[0].item_title = "被意外改写的选项";
  assert.equal((await sdk.verifySurveyJsonUpdate(input, before, credentials, transport([], saved))).outcome, "unknown");
});

test("hide 可通过原生隐藏值确认，不依赖反向转换的 raw 拼写", () => {
  const logic = 'logic { hide "3"; };';
  const questions = [{ q_index: 3, q_type: 3, relation: "-1", is_hide: true }];
  assert.equal(sdk.surveyLogicMatches(logic, 'logic { raw attr "Relation" question "3" = "-1"; };', questions), true);
  assert.equal(sdk.surveyLogicMatches(logic, undefined, questions), true);
  for (const relation of ["", "0", "2,1"]) {
    assert.equal(sdk.surveyLogicMatches(logic, undefined, [{ ...questions[0], relation }]), false);
  }
  assert.equal(sdk.surveyLogicMatches(logic, undefined, []), false);
  assert.equal(sdk.surveyLogicMatches(logic, undefined, [{ ...questions[0], is_hide: false }]), false);
  assert.equal(sdk.surveyLogicMatches(logic, 'logic { if "2::1" then show "3"; };', questions), false);
});

test("旧完整 DSL 公共接口已删除", () => {
  for (const name of ["queryWjxDsl", "createSurveyByWjxDsl", "updateWjxDsl", "generateWjxDsl", "verifyWjxDslWrite"]) assert.equal(name in sdk, false, name);
  assert.equal(sdk.Action.UPDATE_SURVEY_BY_JSON, "1000109");
  assert.equal(Object.values(sdk.Action).includes("1000110"), false);
  assert.deepEqual(Object.entries(sdk.Action).filter(([, value]) => value === "1000109").map(([name]) => name), ["UPDATE_SURVEY_BY_JSON"]);
  assert.equal("CREATE_SURVEY_BY_WJX_DSL" in sdk.Action, false);
});
