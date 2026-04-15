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
  return { client, server };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Prompt content correctness tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("prompts content correctness", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  // ── 1. design-survey ──────────────────────────────────────────────
  describe("design-survey", () => {
    it("returns messages with topic included", async () => {
      const result = await client.getPrompt({
        name: "design-survey",
        arguments: { topic: "员工满意度" },
      });
      assert.ok(result.messages.length > 0);
      const text = result.messages[0].content.text;
      assert.ok(text.includes("员工满意度"));
    });

    it("includes question type references", async () => {
      const result = await client.getPrompt({
        name: "design-survey",
        arguments: { topic: "产品反馈" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("题型标签"));
      assert.ok(text.includes("[单选题]"));
    });

    it("includes optional target_audience when provided", async () => {
      const result = await client.getPrompt({
        name: "design-survey",
        arguments: { topic: "测试", target_audience: "大学生" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("大学生"));
    });

    it("includes optional survey_type when provided", async () => {
      const result = await client.getPrompt({
        name: "design-survey",
        arguments: { topic: "测试", survey_type: "考试" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("考试"));
    });

    it("defaults survey_type to 调查", async () => {
      const result = await client.getPrompt({
        name: "design-survey",
        arguments: { topic: "测试" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("调查"));
    });

    it("defaults target_audience to 通用", async () => {
      const result = await client.getPrompt({
        name: "design-survey",
        arguments: { topic: "测试" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("通用"));
    });
  });

  // ── 2. create-nps-survey ──────────────────────────────────────────
  describe("create-nps-survey", () => {
    it("returns messages with product name (Chinese)", async () => {
      const result = await client.getPrompt({
        name: "create-nps-survey",
        arguments: { product_name: "微信" },
      });
      assert.ok(result.messages.length > 0);
      const text = result.messages[0].content.text;
      assert.ok(text.includes("微信"));
      assert.ok(text.includes("NPS"));
    });

    it("generates English content when language=en", async () => {
      const result = await client.getPrompt({
        name: "create-nps-survey",
        arguments: { product_name: "WeChat", language: "en" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("WeChat"));
      assert.ok(text.includes("recommend"));
    });

    it("includes create_survey tool reference", async () => {
      const result = await client.getPrompt({
        name: "create-nps-survey",
        arguments: { product_name: "TestProduct" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("create_survey"));
    });

    it("includes q_type and q_subtype references", async () => {
      const result = await client.getPrompt({
        name: "create-nps-survey",
        arguments: { product_name: "Test" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("q_type"));
    });
  });

  // ── 3. analyze-results ────────────────────────────────────────────
  describe("analyze-results", () => {
    it("returns messages with survey_id", async () => {
      const result = await client.getPrompt({
        name: "analyze-results",
        arguments: { survey_id: "12345" },
      });
      assert.ok(result.messages.length > 0);
      const text = result.messages[0].content.text;
      assert.ok(text.includes("12345"));
    });

    it("references get_survey and get_report tools", async () => {
      const result = await client.getPrompt({
        name: "analyze-results",
        arguments: { survey_id: "99" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("get_survey"));
      assert.ok(text.includes("get_report"));
    });

    it("includes optional focus_areas when provided", async () => {
      const result = await client.getPrompt({
        name: "analyze-results",
        arguments: { survey_id: "1", focus_areas: "NPS 分析" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("NPS 分析"));
    });

    it("references query_responses tool", async () => {
      const result = await client.getPrompt({
        name: "analyze-results",
        arguments: { survey_id: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("query_responses"));
    });
  });

  // ── 4. nps-analysis ───────────────────────────────────────────────
  describe("nps-analysis", () => {
    it("returns messages with survey_id", async () => {
      const result = await client.getPrompt({
        name: "nps-analysis",
        arguments: { survey_id: "67890" },
      });
      assert.ok(result.messages.length > 0);
      const text = result.messages[0].content.text;
      assert.ok(text.includes("67890"));
    });

    it("includes NPS calculation reference", async () => {
      const result = await client.getPrompt({
        name: "nps-analysis",
        arguments: { survey_id: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("NPS"));
      assert.ok(text.includes("推荐者") || text.includes("Promoters"));
      assert.ok(text.includes("贬损者") || text.includes("Detractors"));
    });

    it("includes optional time_range when provided", async () => {
      const result = await client.getPrompt({
        name: "nps-analysis",
        arguments: { survey_id: "1", time_range: "最近7天" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("最近7天"));
    });

    it("includes benchmark comparisons", async () => {
      const result = await client.getPrompt({
        name: "nps-analysis",
        arguments: { survey_id: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("优秀"));
      assert.ok(text.includes("良好"));
    });
  });

  // ── 5. csat-analysis ──────────────────────────────────────────────
  describe("csat-analysis", () => {
    it("returns messages with survey_id", async () => {
      const result = await client.getPrompt({
        name: "csat-analysis",
        arguments: { survey_id: "11111" },
      });
      assert.ok(result.messages.length > 0);
      const text = result.messages[0].content.text;
      assert.ok(text.includes("11111"));
    });

    it("includes CSAT calculation reference", async () => {
      const result = await client.getPrompt({
        name: "csat-analysis",
        arguments: { survey_id: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("CSAT"));
      assert.ok(text.includes("满意"));
    });

    it("includes optional satisfaction_question_index when provided", async () => {
      const result = await client.getPrompt({
        name: "csat-analysis",
        arguments: { survey_id: "1", satisfaction_question_index: "3" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("3"));
    });

    it("references 5-point and 7-point scales", async () => {
      const result = await client.getPrompt({
        name: "csat-analysis",
        arguments: { survey_id: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("5 分制"));
      assert.ok(text.includes("7 分制"));
    });
  });

  // ── 6. cross-tabulation ───────────────────────────────────────────
  describe("cross-tabulation", () => {
    it("returns messages with survey_id and question indices", async () => {
      const result = await client.getPrompt({
        name: "cross-tabulation",
        arguments: { survey_id: "999", question_a: "1", question_b: "5" },
      });
      assert.ok(result.messages.length > 0);
      const text = result.messages[0].content.text;
      assert.ok(text.includes("999"));
      assert.ok(text.includes("1"));
      assert.ok(text.includes("5"));
    });

    it("references submitdata format", async () => {
      const result = await client.getPrompt({
        name: "cross-tabulation",
        arguments: { survey_id: "1", question_a: "2", question_b: "3" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("submitdata"));
    });

    it("includes cross-tabulation table structure", async () => {
      const result = await client.getPrompt({
        name: "cross-tabulation",
        arguments: { survey_id: "1", question_a: "2", question_b: "3" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("频次") || text.includes("百分比"));
    });

    it("references get_survey and query_responses", async () => {
      const result = await client.getPrompt({
        name: "cross-tabulation",
        arguments: { survey_id: "1", question_a: "2", question_b: "3" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("get_survey"));
      assert.ok(text.includes("query_responses"));
    });
  });

  // ── 7. sentiment-analysis ─────────────────────────────────────────
  describe("sentiment-analysis", () => {
    it("returns messages with survey_id", async () => {
      const result = await client.getPrompt({
        name: "sentiment-analysis",
        arguments: { survey_id: "555" },
      });
      assert.ok(result.messages.length > 0);
      const text = result.messages[0].content.text;
      assert.ok(text.includes("555"));
    });

    it("includes sentiment categories", async () => {
      const result = await client.getPrompt({
        name: "sentiment-analysis",
        arguments: { survey_id: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("正面") || text.includes("Positive"));
      assert.ok(text.includes("负面") || text.includes("Negative"));
      assert.ok(text.includes("中性") || text.includes("Neutral"));
    });

    it("includes optional question_index when provided", async () => {
      const result = await client.getPrompt({
        name: "sentiment-analysis",
        arguments: { survey_id: "1", question_index: "7" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("7"));
    });

    it("references open-ended question types", async () => {
      const result = await client.getPrompt({
        name: "sentiment-analysis",
        arguments: { survey_id: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("填空题") || text.includes("q_type=5"));
    });
  });

  // ── 8. survey-health-check ────────────────────────────────────────
  describe("survey-health-check", () => {
    it("returns messages with survey_id", async () => {
      const result = await client.getPrompt({
        name: "survey-health-check",
        arguments: { survey_id: "777" },
      });
      assert.ok(result.messages.length > 0);
      const text = result.messages[0].content.text;
      assert.ok(text.includes("777"));
    });

    it("includes health check categories", async () => {
      const result = await client.getPrompt({
        name: "survey-health-check",
        arguments: { survey_id: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("完成率"));
      assert.ok(text.includes("直线作答") || text.includes("Straight-lining"));
    });

    it("references get_survey, get_report, and query_responses", async () => {
      const result = await client.getPrompt({
        name: "survey-health-check",
        arguments: { survey_id: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("get_survey"));
      assert.ok(text.includes("get_report"));
      assert.ok(text.includes("query_responses"));
    });

    it("includes health score output reference", async () => {
      const result = await client.getPrompt({
        name: "survey-health-check",
        arguments: { survey_id: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("100"));
    });
  });

  // ── 9. comparative-analysis ───────────────────────────────────────
  describe("comparative-analysis", () => {
    it("returns messages with survey ids", async () => {
      const result = await client.getPrompt({
        name: "comparative-analysis",
        arguments: { survey_ids: "12345,67890" },
      });
      assert.ok(result.messages.length > 0);
      const text = result.messages[0].content.text;
      assert.ok(text.includes("12345"));
      assert.ok(text.includes("67890"));
    });

    it("defaults to survey comparison type", async () => {
      const result = await client.getPrompt({
        name: "comparative-analysis",
        arguments: { survey_ids: "1,2" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("跨问卷"));
    });

    it("supports time comparison type", async () => {
      const result = await client.getPrompt({
        name: "comparative-analysis",
        arguments: { survey_ids: "1,2", comparison_type: "time" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("跨时段"));
    });

    it("references get_survey for each survey", async () => {
      const result = await client.getPrompt({
        name: "comparative-analysis",
        arguments: { survey_ids: "111,222,333" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("111"));
      assert.ok(text.includes("222"));
      assert.ok(text.includes("333"));
      assert.ok(text.includes("get_survey"));
      assert.ok(text.includes("get_report"));
    });

    it("includes significance threshold (10%)", async () => {
      const result = await client.getPrompt({
        name: "comparative-analysis",
        arguments: { survey_ids: "1,2" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("10%"));
    });
  });

  // ── 10. configure-webhook ─────────────────────────────────────────
  describe("configure-webhook", () => {
    it("returns messages with vid", async () => {
      const result = await client.getPrompt({
        name: "configure-webhook",
        arguments: { vid: "88888" },
      });
      assert.ok(result.messages.length > 0);
      const text = result.messages[0].content.text;
      assert.ok(text.includes("88888"));
    });

    it("includes webhook configuration steps", async () => {
      const result = await client.getPrompt({
        name: "configure-webhook",
        arguments: { vid: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("push_url"));
      assert.ok(text.includes("AES-128-CBC"));
    });

    it("references get_survey_settings and update_survey_settings", async () => {
      const result = await client.getPrompt({
        name: "configure-webhook",
        arguments: { vid: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("get_survey_settings"));
      assert.ok(text.includes("update_survey_settings"));
    });

    it("includes signature verification reference", async () => {
      const result = await client.getPrompt({
        name: "configure-webhook",
        arguments: { vid: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("SHA1") || text.includes("签名"));
      assert.ok(text.includes("X-Wjx-Signature"));
    });

    it("references SDK decodePushPayload for decryption", async () => {
      const result = await client.getPrompt({
        name: "configure-webhook",
        arguments: { vid: "1" },
      });
      const text = result.messages[0].content.text;
      assert.ok(text.includes("decodePushPayload"));
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Prompts listing test
// ═══════════════════════════════════════════════════════════════════════════════

describe("prompts listing", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  it("lists all 10 prompts", async () => {
    const result = await client.listPrompts();
    const names = result.prompts.map((p) => p.name).sort();
    assert.ok(names.includes("design-survey"));
    assert.ok(names.includes("create-nps-survey"));
    assert.ok(names.includes("analyze-results"));
    assert.ok(names.includes("nps-analysis"));
    assert.ok(names.includes("csat-analysis"));
    assert.ok(names.includes("cross-tabulation"));
    assert.ok(names.includes("sentiment-analysis"));
    assert.ok(names.includes("survey-health-check"));
    assert.ok(names.includes("comparative-analysis"));
    assert.ok(names.includes("configure-webhook"));
    assert.ok(result.prompts.length >= 10);
  });
});
