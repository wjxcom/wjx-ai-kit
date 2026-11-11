import assert from "node:assert/strict";
import { test } from "node:test";
import { createSurveyByJson, preflightJsonl } from "../dist/index.js";

const DOCUMENTED_INTERFACE_QTYPES = [
  "签名题",
  "地图",
  "折叠栏目",
  "轮播图",
  "图片OCR",
  "预约题",
  "商品题",
  "性别",
  "年龄段",
  "民族",
  "学历",
  "婚姻",
  "手机验证",
  "时间",
  "职业",
  "行业",
  "密码",
];

test("1000106 accepts every documented interface qtype", () => {
  for (const qtype of DOCUMENTED_INTERFACE_QTYPES) {
    const jsonl = [
      JSON.stringify({ qtype: "问卷基础信息", title: "完整题型覆盖" }),
      JSON.stringify({ qtype, title: `测试${qtype}` }),
    ].join("\n");
    assert.doesNotThrow(() => preflightJsonl(jsonl), qtype);
  }
});

test("1000106 accepts every creatable atype and rejects the legacy user-system type", async () => {
  const jsonl = [
    JSON.stringify({ qtype: "问卷基础信息", title: "atype 覆盖" }),
    JSON.stringify({ qtype: "单选", title: "选择一个", select: ["A", "B"] }),
  ].join("\n");
  const requests = [];
  const fetchImpl = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ result: true, data: { vid: 1 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  for (const atype of [1, 2, 3, 4, 5, 6, 7, 9, 10, 11]) {
    await assert.doesNotReject(
      createSurveyByJson({ jsonl, atype }, { apiKey: "test-key" }, fetchImpl),
      `atype=${atype} should be accepted`,
    );
  }
  await assert.rejects(
    createSurveyByJson({ jsonl, atype: 8 }, { apiKey: "test-key" }, fetchImpl),
    /atype=8/,
  );
  assert.equal(requests.length, 10, "legacy atype=8 must be rejected before transport");
  assert.deepEqual(requests.map((request) => request.atype), [1, 2, 3, 4, 5, 6, 7, 9, 10, 11]);
});
