import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";

// Set dummy env vars so API-calling tools don't crash on missing credentials
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
// Analytics tools (pure compute — full end-to-end tests)
// ═══════════════════════════════════════════════════════════════════════════════

describe("analytics tools via MCP", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  // ── calculate_nps ─────────────────────────────────────────────────
  describe("calculate_nps", () => {
    it("with valid scores returns NPS result", async () => {
      const result = await client.callTool({
        name: "calculate_nps",
        arguments: { scores: [10, 9, 8, 7, 6, 5, 4] },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(typeof data.score, "number");
      assert.equal(typeof data.promoters, "object");
      assert.equal(typeof data.detractors, "object");
    });

    it("with all promoters returns NPS 100", async () => {
      const result = await client.callTool({
        name: "calculate_nps",
        arguments: { scores: [10, 10, 9, 9] },
      });
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.score, 100);
    });

    it("with empty scores returns NPS 0", async () => {
      const result = await client.callTool({
        name: "calculate_nps",
        arguments: { scores: [] },
      });
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.score, 0);
    });

    it("rejects missing scores", async () => {
      const result = await client.callTool({
        name: "calculate_nps",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects scores out of 0-10 range", async () => {
      const result = await client.callTool({
        name: "calculate_nps",
        arguments: { scores: [11, -1] },
      });
      assert.equal(result.isError, true);
    });

    it("rejects non-integer scores", async () => {
      const result = await client.callTool({
        name: "calculate_nps",
        arguments: { scores: [7.5] },
      });
      assert.equal(result.isError, true);
    });
  });

  // ── calculate_csat ────────────────────────────────────────────────
  describe("calculate_csat", () => {
    it("with valid 5-point scores", async () => {
      const result = await client.callTool({
        name: "calculate_csat",
        arguments: { scores: [5, 4, 3, 2, 1] },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(typeof data.csat, "number");
      assert.equal(data.satisfiedCount, 2);
    });

    it("with 7-point scale", async () => {
      const result = await client.callTool({
        name: "calculate_csat",
        arguments: { scores: [7, 6, 5, 4, 3], scale_type: "7-point" },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.satisfiedCount, 3);
    });

    it("with empty scores", async () => {
      const result = await client.callTool({
        name: "calculate_csat",
        arguments: { scores: [] },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.csat, 0);
    });

    it("rejects missing scores", async () => {
      const result = await client.callTool({
        name: "calculate_csat",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects invalid scale_type", async () => {
      const result = await client.callTool({
        name: "calculate_csat",
        arguments: { scores: [5, 4], scale_type: "10-point" },
      });
      assert.equal(result.isError, true);
    });
  });

  // ── decode_responses ──────────────────────────────────────────────
  describe("decode_responses", () => {
    it("decodes single choice answer", async () => {
      const result = await client.callTool({
        name: "decode_responses",
        arguments: { submitdata: "1$3}2$1" },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.count, 2);
      assert.equal(data.answers[0].questionIndex, 1);
    });

    it("decodes multi-choice answer", async () => {
      const result = await client.callTool({
        name: "decode_responses",
        arguments: { submitdata: "1$1|2|3" },
      });
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.answers[0].type, "multi");
      assert.deepEqual(data.answers[0].value, ["1", "2", "3"]);
    });

    it("handles empty submitdata", async () => {
      const result = await client.callTool({
        name: "decode_responses",
        arguments: { submitdata: "" },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.count, 0);
    });

    it("rejects missing submitdata", async () => {
      const result = await client.callTool({
        name: "decode_responses",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });

  // ── detect_anomalies ──────────────────────────────────────────────
  describe("detect_anomalies", () => {
    it("detects straight-lining", async () => {
      const result = await client.callTool({
        name: "detect_anomalies",
        arguments: {
          responses: [
            { id: 1, answers: [1, 1, 1, 1], duration_seconds: 120 },
            { id: 2, answers: [1, 2, 3, 4], duration_seconds: 120 },
          ],
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.totalChecked, 2);
      const flagged = data.flagged.find((f) => f.responseId === 1);
      assert.ok(flagged);
      assert.ok(flagged.reasons.includes("straight-lining"));
    });

    it("handles empty responses", async () => {
      const result = await client.callTool({
        name: "detect_anomalies",
        arguments: { responses: [] },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.totalChecked, 0);
    });

    it("rejects missing responses", async () => {
      const result = await client.callTool({
        name: "detect_anomalies",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });

  // ── compare_metrics ───────────────────────────────────────────────
  describe("compare_metrics", () => {
    it("compares two metric sets", async () => {
      const result = await client.callTool({
        name: "compare_metrics",
        arguments: {
          set_a: { completion_rate: 0.8, avg_score: 75 },
          set_b: { completion_rate: 0.9, avg_score: 80 },
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(Array.isArray(data.comparisons));
      assert.equal(data.comparisons.length, 2);
    });

    it("handles empty sets", async () => {
      const result = await client.callTool({
        name: "compare_metrics",
        arguments: { set_a: {}, set_b: {} },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.comparisons.length, 0);
    });

    it("rejects missing set_a", async () => {
      const result = await client.callTool({
        name: "compare_metrics",
        arguments: { set_b: { x: 1 } },
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing set_b", async () => {
      const result = await client.callTool({
        name: "compare_metrics",
        arguments: { set_a: { x: 1 } },
      });
      assert.equal(result.isError, true);
    });
  });

  // ── decode_push_payload ───────────────────────────────────────────
  describe("decode_push_payload", () => {
    it("rejects missing encrypted_data", async () => {
      const result = await client.callTool({
        name: "decode_push_payload",
        arguments: { app_key: "test-key" },
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing app_key", async () => {
      const result = await client.callTool({
        name: "decode_push_payload",
        arguments: { encrypted_data: "dGVzdA==" },
      });
      assert.equal(result.isError, true);
    });

    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "decode_push_payload",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Survey tools — validation tests (API calls will fail, testing error handling)
// ═══════════════════════════════════════════════════════════════════════════════

describe("survey tools validation via MCP", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  describe("create_survey", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "create_survey",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing title", async () => {
      const result = await client.callTool({
        name: "create_survey",
        arguments: { atype: 1, desc: "desc", questions: '[{"q_index":1,"q_type":3}]' },
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing atype", async () => {
      const result = await client.callTool({
        name: "create_survey",
        arguments: { title: "Test", desc: "desc", questions: '[{"q_index":1,"q_type":3}]' },
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing desc", async () => {
      const result = await client.callTool({
        name: "create_survey",
        arguments: { title: "Test", atype: 1, questions: '[{"q_index":1,"q_type":3}]' },
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing questions", async () => {
      const result = await client.callTool({
        name: "create_survey",
        arguments: { title: "Test", atype: 1, desc: "desc" },
      });
      assert.equal(result.isError, true);
    });

    it("rejects empty title", async () => {
      const result = await client.callTool({
        name: "create_survey",
        arguments: { title: "", atype: 1, desc: "desc", questions: '[{"q_index":1}]' },
      });
      assert.equal(result.isError, true);
    });

    it("rejects questions too short", async () => {
      const result = await client.callTool({
        name: "create_survey",
        arguments: { title: "Test", atype: 1, desc: "desc", questions: "x" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("get_survey", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "get_survey",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects vid=0", async () => {
      const result = await client.callTool({
        name: "get_survey",
        arguments: { vid: 0 },
      });
      assert.equal(result.isError, true);
    });

    it("rejects negative vid", async () => {
      const result = await client.callTool({
        name: "get_survey",
        arguments: { vid: -1 },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("list_surveys", () => {
    it("accepts empty arguments (all optional)", async () => {
      const result = await client.callTool({
        name: "list_surveys",
        arguments: {},
      });
      // Will get API error (not validation error) since creds are dummy
      // But should not be isError from validation
      assert.equal(result.isError, true); // API error
      assert.ok(result.content[0].text.length > 0);
    });

    it("rejects page_size > 300", async () => {
      const result = await client.callTool({
        name: "list_surveys",
        arguments: { page_size: 301 },
      });
      assert.equal(result.isError, true);
    });

    it("rejects page_size < 1", async () => {
      const result = await client.callTool({
        name: "list_surveys",
        arguments: { page_size: 0 },
      });
      assert.equal(result.isError, true);
    });

    it("rejects sort > 5", async () => {
      const result = await client.callTool({
        name: "list_surveys",
        arguments: { sort: 6 },
      });
      assert.equal(result.isError, true);
    });

    it("rejects name_like > 10 chars", async () => {
      const result = await client.callTool({
        name: "list_surveys",
        arguments: { name_like: "12345678901" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("update_survey_status", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "update_survey_status",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing vid", async () => {
      const result = await client.callTool({
        name: "update_survey_status",
        arguments: { state: 1 },
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing state", async () => {
      const result = await client.callTool({
        name: "update_survey_status",
        arguments: { vid: 1 },
      });
      assert.equal(result.isError, true);
    });

    it("rejects state > 3", async () => {
      const result = await client.callTool({
        name: "update_survey_status",
        arguments: { vid: 1, state: 4 },
      });
      assert.equal(result.isError, true);
    });

    it("rejects state < 1", async () => {
      const result = await client.callTool({
        name: "update_survey_status",
        arguments: { vid: 1, state: 0 },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("get_survey_settings", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "get_survey_settings",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });

  describe("update_survey_settings", () => {
    it("rejects empty arguments (vid required)", async () => {
      const result = await client.callTool({
        name: "update_survey_settings",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects invalid JSON for api_setting", async () => {
      const result = await client.callTool({
        name: "update_survey_settings",
        arguments: { vid: 1, api_setting: "not json{" },
      });
      assert.equal(result.isError, true);
    });

    it("rejects invalid JSON for msg_setting", async () => {
      const result = await client.callTool({
        name: "update_survey_settings",
        arguments: { vid: 1, msg_setting: "{bad" },
      });
      assert.equal(result.isError, true);
    });

    it("rejects update_survey_settings with no setting fields (only vid)", async () => {
      const result = await client.callTool({
        name: "update_survey_settings",
        arguments: { vid: 12345 },
      });
      assert.equal(result.isError, true);
      assert.ok(result.content[0].text.includes("至少需要提供一个设置项"));
    });
  });

  describe("delete_survey", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "delete_survey",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing username", async () => {
      const result = await client.callTool({
        name: "delete_survey",
        arguments: { vid: 1 },
      });
      assert.equal(result.isError, true);
    });

    it("rejects empty username", async () => {
      const result = await client.callTool({
        name: "delete_survey",
        arguments: { vid: 1, username: "" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("get_question_tags", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "get_question_tags",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects empty username", async () => {
      const result = await client.callTool({
        name: "get_question_tags",
        arguments: { username: "" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("get_tag_details", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "get_tag_details",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects non-positive tag_id", async () => {
      const result = await client.callTool({
        name: "get_tag_details",
        arguments: { tag_id: 0 },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("clear_recycle_bin", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "clear_recycle_bin",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects empty username", async () => {
      const result = await client.callTool({
        name: "clear_recycle_bin",
        arguments: { username: "" },
      });
      assert.equal(result.isError, true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Response tools — validation tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("response tools validation via MCP", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  describe("query_responses", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "query_responses",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects page_size > 50", async () => {
      const result = await client.callTool({
        name: "query_responses",
        arguments: { vid: 1, page_size: 51 },
      });
      assert.equal(result.isError, true);
    });

    it("rejects invalid conds JSON", async () => {
      const result = await client.callTool({
        name: "query_responses",
        arguments: { vid: 1, conds: "not json{" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("query_responses_realtime", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "query_responses_realtime",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });

  describe("download_responses", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "download_responses",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects suffix > 2", async () => {
      const result = await client.callTool({
        name: "download_responses",
        arguments: { vid: 1, suffix: 3 },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("get_report", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "get_report",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects invalid conds JSON", async () => {
      const result = await client.callTool({
        name: "get_report",
        arguments: { vid: 1, conds: "bad{" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("submit_response", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "submit_response",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing submitdata", async () => {
      const result = await client.callTool({
        name: "submit_response",
        arguments: { vid: 1, inputcosttime: 5 },
      });
      assert.equal(result.isError, true);
    });

    it("rejects inputcosttime < 2", async () => {
      const result = await client.callTool({
        name: "submit_response",
        arguments: { vid: 1, inputcosttime: 1, submitdata: "1$2" },
      });
      assert.equal(result.isError, true);
    });
  });

  // get_file_links 已移除 — 仅限混合云/私有化场景

  describe("get_winners", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "get_winners",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });

  describe("modify_response", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "modify_response",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects invalid answers JSON", async () => {
      const result = await client.callTool({
        name: "modify_response",
        arguments: { vid: 1, jid: 1, type: 1, answers: "bad{" },
      });
      assert.equal(result.isError, true);
    });

    it("rejects type != 1", async () => {
      const result = await client.callTool({
        name: "modify_response",
        arguments: { vid: 1, jid: 1, type: 2, answers: '{"1":"10"}' },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("get_360_report", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "get_360_report",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });

  describe("clear_responses", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "clear_responses",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing reset_to_zero", async () => {
      const result = await client.callTool({
        name: "clear_responses",
        arguments: { username: "user1", vid: 1 },
      });
      assert.equal(result.isError, true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Contacts tools — validation tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("contacts tools validation via MCP", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  describe("query_contacts", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "query_contacts",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects empty username", async () => {
      const result = await client.callTool({
        name: "query_contacts",
        arguments: { username: "" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("add_contacts", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "add_contacts",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects non-array members JSON", async () => {
      const result = await client.callTool({
        name: "add_contacts",
        arguments: { username: "user1", members: '{"not":"array"}' },
      });
      assert.equal(result.isError, true);
    });

    it("rejects invalid members JSON", async () => {
      const result = await client.callTool({
        name: "add_contacts",
        arguments: { username: "user1", members: "bad json{" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("manage_contacts", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "manage_contacts",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects invalid operation", async () => {
      const result = await client.callTool({
        name: "manage_contacts",
        arguments: { username: "user1", operation: "invalid", members: "[1]" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("add_admin", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "add_admin",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing admin_name", async () => {
      const result = await client.callTool({
        name: "add_admin",
        arguments: { username: "user1" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("delete_admin", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "delete_admin",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing admin_id", async () => {
      const result = await client.callTool({
        name: "delete_admin",
        arguments: { username: "user1" },
      });
      assert.equal(result.isError, true);
    });

    it("rejects delete_admin with admin_id=0", async () => {
      const result = await client.callTool({
        name: "delete_admin",
        arguments: { username: "test", admin_id: 0 },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("restore_admin", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "restore_admin",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });

  describe("list_departments", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "list_departments",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });

  describe("add_department", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "add_department",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing name", async () => {
      const result = await client.callTool({
        name: "add_department",
        arguments: { username: "user1" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("modify_department", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "modify_department",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing dept_id", async () => {
      const result = await client.callTool({
        name: "modify_department",
        arguments: { username: "user1" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("delete_department", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "delete_department",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects delete_department with dept_id=-1", async () => {
      const result = await client.callTool({
        name: "delete_department",
        arguments: { username: "test", dept_id: -1 },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("list_tags", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "list_tags",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });

  describe("add_tag", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "add_tag",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing tag_name", async () => {
      const result = await client.callTool({
        name: "add_tag",
        arguments: { username: "user1" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("modify_tag", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "modify_tag",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing tag_id", async () => {
      const result = await client.callTool({
        name: "modify_tag",
        arguments: { username: "user1", tag_name: "test" },
      });
      assert.equal(result.isError, true);
    });

    it("rejects modify_tag with tag_id=0", async () => {
      const result = await client.callTool({
        name: "modify_tag",
        arguments: { username: "test", tag_id: 0, tag_name: "new" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("delete_tag", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "delete_tag",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SSO tools — validation tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("sso tools validation via MCP", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  describe("sso_subaccount_url", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects empty subuser", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: { subuser: "" },
      });
      assert.equal(result.isError, true);
    });

    it("rejects role_id > 4", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: { subuser: "sub1", role_id: 5 },
      });
      assert.equal(result.isError, true);
    });

    it("generates URL with valid subuser", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: { subuser: "testuser" },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url);
      assert.equal(data.result, true);
    });
  });

  describe("sso_user_system_url", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "sso_user_system_url",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing uid", async () => {
      const result = await client.callTool({
        name: "sso_user_system_url",
        arguments: { u: "user1", system_id: 1 },
      });
      assert.equal(result.isError, true);
    });

    it("generates URL with valid args", async () => {
      const result = await client.callTool({
        name: "sso_user_system_url",
        arguments: { u: "user1", system_id: 1, uid: "uid1" },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url);
    });
  });

  describe("sso_partner_url", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "sso_partner_url",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("generates URL with valid username", async () => {
      const result = await client.callTool({
        name: "sso_partner_url",
        arguments: { username: "partner1" },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url);
    });
  });

  describe("build_survey_url", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects invalid mode", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: { mode: "invalid" },
      });
      assert.equal(result.isError, true);
    });

    it("generates URL in create mode", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: { mode: "create" },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url);
    });

    it("generates URL in edit mode", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: { mode: "edit", activity: 12345 },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// User system tools — validation tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("user-system tools validation via MCP", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  describe("add_participants", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "add_participants",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing users", async () => {
      const result = await client.callTool({
        name: "add_participants",
        arguments: { username: "user1", usid: 1 },
      });
      assert.equal(result.isError, true);
    });

    it("rejects non-array users JSON", async () => {
      const result = await client.callTool({
        name: "add_participants",
        arguments: { username: "user1", usid: 1, users: '{"not":"array"}' },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("modify_participants", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "modify_participants",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });

  describe("delete_participants", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "delete_participants",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing uids", async () => {
      const result = await client.callTool({
        name: "delete_participants",
        arguments: { username: "user1", usid: 1 },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("query_survey_binding", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "query_survey_binding",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing usid", async () => {
      const result = await client.callTool({
        name: "query_survey_binding",
        arguments: { username: "user1", vid: 1 },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("query_user_surveys", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "query_user_surveys",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing uid", async () => {
      const result = await client.callTool({
        name: "query_user_surveys",
        arguments: { username: "user1", usid: 1 },
      });
      assert.equal(result.isError, true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-user tools — validation tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("multi-user tools validation via MCP", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  describe("add_sub_account", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "add_sub_account",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing password", async () => {
      const result = await client.callTool({
        name: "add_sub_account",
        arguments: { username: "admin", subuser: "sub1" },
      });
      assert.equal(result.isError, true);
    });

    it("rejects role_id > 4", async () => {
      const result = await client.callTool({
        name: "add_sub_account",
        arguments: { username: "admin", subuser: "sub1", password: "pass", role_id: 5 },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("modify_sub_account", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "modify_sub_account",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing subuser", async () => {
      const result = await client.callTool({
        name: "modify_sub_account",
        arguments: { username: "admin" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("delete_sub_account", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "delete_sub_account",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects missing subuser", async () => {
      const result = await client.callTool({
        name: "delete_sub_account",
        arguments: { username: "admin" },
      });
      assert.equal(result.isError, true);
    });
  });

  describe("restore_sub_account", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "restore_sub_account",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });
  });

  describe("query_sub_accounts", () => {
    it("rejects empty arguments", async () => {
      const result = await client.callTool({
        name: "query_sub_accounts",
        arguments: {},
      });
      assert.equal(result.isError, true);
    });

    it("rejects empty username", async () => {
      const result = await client.callTool({
        name: "query_sub_accounts",
        arguments: { username: "" },
      });
      assert.equal(result.isError, true);
    });
  });
});
