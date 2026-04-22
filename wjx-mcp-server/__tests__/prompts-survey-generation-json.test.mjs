import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";

process.env.WJX_APP_ID = process.env.WJX_APP_ID || "test-app-id";
process.env.WJX_APP_KEY = process.env.WJX_APP_KEY || "test-app-key";

async function createTestClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "1.0" });
  await client.connect(clientTransport);
  return { client };
}

// ═══════════════════════════════════════════════════════════════════════════════
// JSONL survey-generation prompt content correctness
// ═══════════════════════════════════════════════════════════════════════════════
//
// 校验：
//   1. 旧 prompt generate-major-survey-json 已被合并并移除
//   2. generate-survey-json 包含专业模型题型 + atype 提示
//   3. generate-form-json 包含表单专用题型 + atype=7 提示
//   4. generate-exam-json 仍含 atype=6 提示
// ═══════════════════════════════════════════════════════════════════════════════

describe("survey-generation-json prompts", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  it("generate-major-survey-json is no longer registered", async () => {
    const list = await client.listPrompts();
    const names = list.prompts.map((p) => p.name);
    assert.equal(
      names.includes("generate-major-survey-json"),
      false,
      "expected legacy prompt to be removed after merge",
    );
    assert.equal(names.includes("generate-survey-json"), true);
  });

  describe("generate-survey-json", () => {
    it("includes topic, MAJOR-tier qtypes, and atype guidance", async () => {
      const result = await client.getPrompt({
        name: "generate-survey-json",
        arguments: { topic: "品牌偏好" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("品牌偏好"));
      // 专业模型题型应当出现（合并自 MAJOR_QTYPES）
      assert.ok(text.includes("BWS"));
      assert.ok(text.includes("MaxDiff"));
      assert.ok(text.includes("Kano"));
      assert.ok(text.includes("PSM"));
      // atype 提示
      assert.ok(text.includes("atype=3"), "should hint atype=3 for 投票");
      assert.ok(text.includes("atype=2") || text.includes("atype=10"), "should hint 测评/量表 atype");
      assert.ok(text.includes("atype=11"), "should hint atype=11 for 民主测评");
      // JSONL 工具调用提示
      assert.ok(text.includes("create_survey_by_json"));
    });

    it("respects question_count and requirements parameters", async () => {
      const result = await client.getPrompt({
        name: "generate-survey-json",
        arguments: {
          topic: "测试",
          question_count: "20",
          requirements: "包含联合分析",
        },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("20"));
      assert.ok(text.includes("包含联合分析"));
    });
  });

  describe("generate-form-json", () => {
    it("uses official '7' whitelist qtypes and atype=7 hint", async () => {
      const result = await client.getPrompt({
        name: "generate-form-json",
        arguments: { topic: "活动报名" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("活动报名"));
      // 表单专用题型
      assert.ok(text.includes("签名题"));
      assert.ok(text.includes("地图"));
      assert.ok(text.includes("表格数值"));
      assert.ok(text.includes("商品题"));
      assert.ok(text.includes("预约题"));
      assert.ok(text.includes("手机验证"));
      // atype 提示
      assert.ok(text.includes("atype=7"));
      assert.ok(text.includes("create_survey_by_json"));
    });
  });

  describe("generate-exam-json", () => {
    it("retains atype=6 hint", async () => {
      const result = await client.getPrompt({
        name: "generate-exam-json",
        arguments: { knowledge_scope: "高中物理" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("高中物理"));
      assert.ok(text.includes("atype=6"));
      assert.ok(text.includes("考试单选"));
      assert.ok(text.includes("create_survey_by_json"));
    });
  });
});
