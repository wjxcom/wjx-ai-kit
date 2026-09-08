import assert from "node:assert/strict";
import { after, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { setCredentialProvider } from "wjx-api-sdk";

import { createServer } from "../dist/server.js";
import { runVerifiedWrite } from "../dist/write-verification.js";

const previousApiKey = process.env.WJX_API_KEY;
process.env.WJX_API_KEY = "write-verification-test-key";
setCredentialProvider(undefined);

after(() => {
  if (previousApiKey === undefined) delete process.env.WJX_API_KEY;
  else process.env.WJX_API_KEY = previousApiKey;
  setCredentialProvider(undefined);
});

async function connectClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "write-verification-test", version: "1.0.0" });
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    },
  };
}

function parse(result) {
  assert.ok(result.content?.[0]?.text, "tool returned no JSON text");
  return JSON.parse(result.content[0].text);
}

async function withMockFetch(route, run) {
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const parsedUrl = new URL(String(url));
    const body = typeof init.body === "string" && init.body ? JSON.parse(init.body) : {};
    const call = {
      action: parsedUrl.searchParams.get("action") ?? "",
      body,
      method: init.method ?? "GET",
    };
    calls.push(call);
    const routed = await route(call, calls);
    if (routed?.throw) throw routed.throw;
    const payload = routed?.response ?? routed ?? { result: true, data: {} };
    return new Response(JSON.stringify(payload), {
      status: routed?.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function survey(status = 1) {
  return {
    result: true,
    data: {
      vid: 810001,
      sid: "verificationSid",
      title: "Verification Survey",
      status,
      version: 3,
      questions: [{ q_index: 1, q_type: 3, q_subtype: 3, q_title: "满意度" }],
      pc_path: "/vm/verificationSid.aspx",
    },
  };
}

test("runVerifiedWrite downgrades verified reports with missing structural evidence", async () => {
  const result = await runVerifiedWrite({
    operation: "inconsistent-verifier",
    write: async () => ({ result: true, data: { saved: true } }),
    verify: async () => ({
      outcome: "verified",
      verification: { structure: false, status: true, count: false, link: true },
      warnings: [],
    }),
  });
  assert.equal(result.isError, true);
  const payload = parse(result);
  assert.equal(payload.result, false);
  assert.equal(payload.outcome, "unknown");
  assert.equal(payload.data.outcome, "unknown");
  assert.equal(payload.data.verification.structure, false);
  assert.ok(payload.data.warnings.some((warning) => /结构|证据|验证/.test(warning)));
  assert.ok(payload.verificationRequired?.length > 0);
});

test("survey writes return verified read-back evidence", async () => {
  const { client, close } = await connectClient();
  let status = 0;
  const settings = { msg_setting: { post_url: "https://example.test/original", quick_post: false, retry: true } };
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") return survey(status);
      if (call.action === "1000102") {
        status = call.body.state;
        return { result: true, data: { saved: true } };
      }
      if (call.action === "1000003") return { result: true, data: structuredClone(settings) };
      if (call.action === "1000103") {
        settings.msg_setting = JSON.parse(call.body.msg_setting);
        return { result: true, data: { saved: true } };
      }
      if (call.action === "1000301") {
        status = 3;
        return { result: true, data: { deleted: true } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const published = await client.callTool({
        name: "update_survey_status",
        arguments: { vid: 810001, state: 1 },
      });
      assert.equal(published.isError, false);
      const publishedPayload = parse(published);
      assert.equal(publishedPayload.result, true);
      assert.equal(publishedPayload.outcome, "verified");
      assert.equal(publishedPayload.data.outcome, "verified");
      assert.equal(publishedPayload.data.verification.status, true);

      const updated = await client.callTool({
        name: "update_survey_settings",
        arguments: { vid: 810001, msg_setting: JSON.stringify({ quick_post: true }) },
      });
      assert.equal(updated.isError, false);
      const updatedPayload = parse(updated);
      assert.equal(updatedPayload.outcome, "verified");
      assert.equal(updatedPayload.data.verification.status, true);
      assert.deepEqual(JSON.parse(calls.findLast((entry) => entry.action === "1000103").body.msg_setting), {
        post_url: "https://example.test/original",
        quick_post: true,
        retry: true,
      });

      const deleted = await client.callTool({
        name: "delete_survey",
        arguments: { vid: 810001, username: "owner" },
      });
      assert.equal(deleted.isError, false);
      const deletedPayload = parse(deleted);
      assert.equal(deletedPayload.outcome, "verified");
      assert.equal(deletedPayload.data.verification.status, true);
      assert.deepEqual(calls.map((entry) => entry.action), [
        "1000001", "1000102", "1000001",
        "1000003", "1000103", "1000003",
        "1000001", "1000301", "1000001",
      ]);
    });
  } finally {
    await close();
  }
});

test("survey status write stops before the destructive call when the pre-read identity differs", async () => {
  const { client, close } = await connectClient("status-pre-read-wrong-identity");
  let writeCalls = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") {
        const response = survey(1);
        response.data.vid = 999999;
        return response;
      }
      if (call.action === "1000102") {
        writeCalls += 1;
        return { result: true, data: { saved: true } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "update_survey_status",
        arguments: { vid: 810001, state: 2 },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.result, false);
      assert.match(payload.errormsg, /身份|编号|停止/);
      assert.equal(writeCalls, 0, "a mismatched pre-read must block the status write");
      assert.deepEqual(calls.map((entry) => entry.action), ["1000001"]);
    });
  } finally {
    await close();
  }
});

test("submit response stops before writing when the survey pre-read has no target identity", async () => {
  const { client, close } = await connectClient("submit-pre-read-missing-identity");
  let writeCalls = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") {
        const response = survey(1);
        delete response.data.vid;
        return response;
      }
      if (call.action === "1001001") {
        writeCalls += 1;
        return { result: true, data: { jid: 901 } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "submit_response",
        arguments: { vid: 810001, inputcosttime: 30, submitdata: "1$2" },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.result, false);
      assert.match(payload.errormsg, /身份|编号|停止/);
      assert.equal(writeCalls, 0, "a survey identity-less pre-read must block submission");
      assert.deepEqual(calls.map((entry) => entry.action), ["1000001"]);
    });
  } finally {
    await close();
  }
});

test("submit response does not bypass a mismatched survey identity with explicit jpmversion", async () => {
  const { client, close } = await connectClient("submit-pre-read-explicit-version-wrong-identity");
  let writeCalls = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") {
        const response = survey(1);
        response.data.vid = 999999;
        return response;
      }
      if (call.action === "1001001") {
        writeCalls += 1;
        return { result: true, data: { jid: 902 } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "submit_response",
        arguments: { vid: 810001, inputcosttime: 30, submitdata: "1$2", jpmversion: 7 },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.result, false);
      assert.match(payload.errormsg, /身份|编号|停止/);
      assert.equal(writeCalls, 0, "explicit jpmversion may bypass a failed lookup, but never an identity mismatch");
      assert.deepEqual(calls.map((entry) => entry.action), ["1000001"]);
    });
  } finally {
    await close();
  }
});

test("submit response rejects a malformed identity alias before writing", async () => {
  const { client, close } = await connectClient("submit-pre-read-malformed-identity");
  let writeCalls = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") {
        const response = survey(1);
        response.data.activity = "not-a-survey-id";
        return response;
      }
      if (call.action === "1001001") {
        writeCalls += 1;
        return { result: true, data: { jid: 903 } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "submit_response",
        arguments: { vid: 810001, inputcosttime: 30, submitdata: "1$2", jpmversion: 7 },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.result, false);
      assert.match(payload.errormsg, /身份|编号|停止/);
      assert.equal(writeCalls, 0, "a malformed identity alias must block submission");
      assert.deepEqual(calls.map((entry) => entry.action), ["1000001"]);
    });
  } finally {
    await close();
  }
});

test("settings write stops before writing when the settings pre-read names another survey", async () => {
  const { client, close } = await connectClient("settings-pre-read-wrong-identity");
  let writeCalls = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000003") {
        return {
          result: true,
          data: { vid: 999999, msg_setting: { post_url: "https://example.test/original", quick_post: false } },
        };
      }
      if (call.action === "1000103") {
        writeCalls += 1;
        return { result: true, data: { saved: true } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "update_survey_settings",
        arguments: { vid: 810001, msg_setting: JSON.stringify({ quick_post: true }) },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.result, false);
      assert.match(payload.errormsg, /身份|编号|停止/);
      assert.equal(writeCalls, 0, "a mismatched settings pre-read must block the replacement write");
      assert.deepEqual(calls.map((entry) => entry.action), ["1000003"]);
    });
  } finally {
    await close();
  }
});

test("settings post-read with another survey identity is reported as unknown", async () => {
  const { client, close } = await connectClient("settings-post-read-wrong-identity");
  let settingsReads = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000003") {
        settingsReads += 1;
        return {
          result: true,
          data: {
            ...(settingsReads > 1 ? { vid: 999999 } : {}),
            msg_setting: { post_url: "https://example.test/original", quick_post: settingsReads > 1 },
          },
        };
      }
      if (call.action === "1000103") return { result: true, data: { saved: true } };
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "update_survey_settings",
        arguments: { vid: 810001, msg_setting: JSON.stringify({ quick_post: true }) },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.result, false);
      assert.equal(payload.outcome, "unknown");
      assert.equal(payload.data.verification.structure, false);
      assert.match(payload.data.warnings.join(" "), /身份|编号|survey.*id/i);
      assert.deepEqual(calls.map((entry) => entry.action), ["1000003", "1000103", "1000003"]);
    });
  } finally {
    await close();
  }
});

test("delete survey polls read-only state until a terminal deleted status", async () => {
  const { client, close } = await connectClient();
  let reads = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") {
        reads += 1;
        // Pre-read is active; the first post-read is eventually consistent;
        // the second post-read reaches the recycle-bin deleted state.
        return survey(reads === 3 ? 3 : 1);
      }
      if (call.action === "1000301") return { result: true, data: { deleted: true } };
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "delete_survey",
        arguments: { vid: 810001, username: "owner" },
      });
      assert.equal(result.isError, false);
      const payload = parse(result);
      assert.equal(payload.outcome, "verified");
      assert.equal(payload.data.status, "deleted");
      assert.equal(payload.data.attempts, 2);
      assert.equal(reads, 3);
      assert.deepEqual(calls.map((entry) => entry.action), ["1000001", "1000301", "1000001", "1000001"]);
    });
  } finally {
    await close();
  }
});

test("normal delete does not accept hard-deleted status as recycle-bin proof", async () => {
  const { client, close } = await connectClient("delete-normal-hard-status");
  const originalSetTimeout = globalThis.setTimeout;
  let reads = 0;
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (typeof delay === "number" && delay <= 2_000) {
      callback(...args);
      return 0;
    }
    return originalSetTimeout(callback, delay, ...args);
  };
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") {
        reads += 1;
        return survey(reads === 1 ? 1 : 4);
      }
      if (call.action === "1000301") return { result: true, data: { deleted: true } };
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "delete_survey",
        arguments: { vid: 810001, username: "owner" },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.outcome, "unknown");
      assert.equal(payload.data.verification.status, false);
      assert.match(payload.data.warnings.join(" "), /状态|回收站|status=3/i);
      assert.equal(reads, 11);
      assert.equal(calls.filter((entry) => entry.action === "1000301").length, 1);
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    await close();
  }
});

test("delete survey keeps polling through a delayed hard-delete state", async () => {
  const { client, close } = await connectClient("delete-hard-delete-delayed");
  const originalSetTimeout = globalThis.setTimeout;
  let reads = 0;
  // Keep the test fast while leaving the SDK's request timeout timers intact.
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (typeof delay === "number" && delay <= 2_000) {
      callback(...args);
      return 0;
    }
    return originalSetTimeout(callback, delay, ...args);
  };
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") {
        reads += 1;
        // The service can take several seconds to expose status=4. The old
        // four-and-a-half-second window stopped before this tenth read.
        return survey(reads >= 10 ? 4 : 1);
      }
      if (call.action === "1000301") return { result: true, data: { deleted: true } };
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "delete_survey",
        arguments: { vid: 810001, username: "owner", completely_delete: true },
      });
      assert.equal(result.isError, false, JSON.stringify(result));
      const payload = parse(result);
      assert.equal(payload.outcome, "verified");
      assert.equal(payload.data.status, "hard-deleted");
      assert.equal(reads, 10);
      assert.equal(calls.filter((entry) => entry.action === "1000301").length, 1);
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    await close();
  }
});

test("delete survey does not verify a terminal state for a different survey id", async () => {
  const { client, close } = await connectClient("delete-wrong-identity");
  const originalSetTimeout = globalThis.setTimeout;
  let reads = 0;
  let deleteCalls = 0;
  // Keep the bounded read-back loop fast while preserving SDK request timers.
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (typeof delay === "number" && delay <= 2_000) {
      callback(...args);
      return 0;
    }
    return originalSetTimeout(callback, delay, ...args);
  };
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") {
        reads += 1;
        const response = survey(reads === 1 ? 1 : 3);
        if (reads > 1) response.data.vid = 999999;
        return response;
      }
      if (call.action === "1000301") {
        deleteCalls += 1;
        return { result: true, data: { deleted: true } };
      }
      return { result: true, data: {} };
    }, async () => {
      const result = await client.callTool({
        name: "delete_survey",
        arguments: { vid: 810001, username: "owner" },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.outcome, "unknown");
      assert.equal(payload.data.verification.structure, false);
      assert.equal(payload.data.verification.status, true);
      assert.equal(deleteCalls, 1, "the destructive write must not be replayed");
      assert.ok(reads >= 2, "the terminal state was only reported for the wrong id");
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    await close();
  }
});

test("clear recycle bin does not verify a terminal state for a different survey id", async () => {
  const { client, close } = await connectClient("clear-bin-wrong-identity");
  let reads = 0;
  let clearCalls = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") {
        reads += 1;
        const response = survey(reads === 1 ? 3 : 4);
        if (reads > 1) response.data.vid = 999999;
        return response;
      }
      if (call.action === "1000301") {
        clearCalls += 1;
        return { result: true, data: { cleared: true } };
      }
      return { result: true, data: {} };
    }, async () => {
      const result = await client.callTool({
        name: "clear_recycle_bin",
        arguments: { username: "owner", vid: 810001 },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.outcome, "unknown");
      assert.equal(payload.data.verification.structure, false);
      assert.equal(payload.data.verification.status, true);
      assert.equal(clearCalls, 1, "the destructive write must not be replayed");
    });
  } finally {
    await close();
  }
});

test("clear recycle bin reports unknown when not-found cannot prove status 4", async () => {
  const { client, close } = await connectClient("clear-bin-not-found");
  let clearCalls = 0;
  let reads = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") {
        reads += 1;
        if (reads === 1) return survey(3);
        return { result: false, errormsg: "survey not found" };
      }
      if (call.action === "1000301") {
        clearCalls += 1;
        return { result: true, data: { cleared: true } };
      }
      return { result: true, data: {} };
    }, async () => {
      const result = await client.callTool({
        name: "clear_recycle_bin",
        arguments: { username: "owner", vid: 810001 },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.outcome, "unknown");
      assert.equal(payload.data.verification.status, false);
      assert.ok(payload.data.warnings.some((warning) => /status=4|彻底删除|证明/.test(warning)));
      assert.equal(clearCalls, 1, "the destructive write must not be replayed");
    });
  } finally {
    await close();
  }
});

test("clear recycle bin accepts string lifecycle statuses", async () => {
  const { client, close } = await connectClient("clear-bin-string-status");
  let readCount = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") {
        readCount += 1;
        return survey(readCount === 1 ? "3" : readCount === 2 ? "3" : "4");
      }
      if (call.action === "1000301") return { result: true, data: { cleared: true } };
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "clear_recycle_bin",
        arguments: { username: "owner", vid: 810001 },
      });
      assert.equal(result.isError, false, JSON.stringify(result));
      const payload = parse(result);
      assert.equal(payload.outcome, "verified");
      assert.equal(payload.data.verification.structure, true);
      assert.equal(payload.data.verification.status, true);
      assert.deepEqual(calls.map((entry) => entry.action), ["1000001", "1000301", "1000001", "1000001"]);
    });
  } finally {
    await close();
  }
});

test("clear recycle bin stops before writing when the recycle count is null", async () => {
  const { client, close } = await connectClient("clear-bin-null-count");
  let clearCalls = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000002") return { result: true, data: { total_count: null } };
      if (call.action === "1000302") {
        clearCalls += 1;
        return { result: true, data: { cleared: true } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "clear_recycle_bin",
        arguments: { username: "owner" },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.match(payload.errormsg, /回收站|计数|停止/);
      assert.equal(clearCalls, 0);
      assert.deepEqual(calls.map((entry) => entry.action), ["1000002"]);
    });
  } finally {
    await close();
  }
});

test("clear recycle bin stops before writing when the recycle count is empty", async () => {
  const { client, close } = await connectClient("clear-bin-empty-count");
  let clearCalls = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000002") return { result: true, data: { total_count: "" } };
      if (call.action === "1000302") {
        clearCalls += 1;
        return { result: true, data: { cleared: true } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "clear_recycle_bin",
        arguments: { username: "owner" },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.match(payload.errormsg, /回收站|计数|停止/);
      assert.equal(clearCalls, 0);
      assert.deepEqual(calls.map((entry) => entry.action), ["1000002"]);
    });
  } finally {
    await close();
  }
});

test("create survey reports unknown when a known JSONL qtype is read back as another type", async () => {
  const { client, close } = await connectClient();
  try {
    await withMockFetch((call) => {
      if (call.action === "1000106") return { result: true, data: { vid: 810002 } };
      if (call.action === "1000001") {
        return {
          result: true,
          data: {
            vid: 810002,
            sid: "qtypeMismatchSid",
            title: "题型校验",
            status: 1,
            // The request is a multi-select question (q_type=4), but the
            // simulated server read-back deliberately reports single choice.
            questions: [{ q_index: 1, q_type: 3, q_subtype: 3, q_title: "Q" }],
            pc_path: "/vm/qtypeMismatchSid.aspx",
          },
        };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "create_survey_by_json",
        arguments: {
          jsonl: [
            '{"qtype":"问卷基础信息","title":"题型校验"}',
            '{"qtype":"多选","title":"Q","select":["A","B"]}',
          ].join("\n"),
          atype: 1,
        },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.result, false);
      assert.equal(payload.outcome, "unknown");
      assert.equal(payload.data.verification.structure, false);
      assert.ok(payload.data.warnings.some((warning) => /q_type|题目/.test(warning)));
    });
  } finally {
    await close();
  }
});

test("create survey does not treat a null status as a verified draft", async () => {
  const { client, close } = await connectClient("create-null-status");
  try {
    await withMockFetch((call) => {
      if (call.action === "1000106") return { result: true, data: { vid: 810005 } };
      if (call.action === "1000001") {
        return {
          result: true,
          data: {
            vid: 810005,
            sid: "nullStatusSid",
            title: "缺失状态",
            status: null,
            questions: [{ q_index: 1, q_type: 3, q_subtype: 3, q_title: "Q" }],
            pc_path: "/vm/nullStatusSid.aspx",
          },
        };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "create_survey_by_json",
        arguments: {
          jsonl: [
            '{"qtype":"问卷基础信息","title":"缺失状态"}',
            '{"qtype":"单选","title":"Q","select":["A","B"]}',
          ].join("\n"),
          atype: 1,
        },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.result, false);
      assert.equal(payload.outcome, "unknown");
      assert.equal(payload.data.verification.status, false);
      assert.ok(payload.data.warnings.some((warning) => /状态/.test(warning)));
      assert.deepEqual(calls.map((entry) => entry.action), ["1000106", "1000001", "1000002"]);
    });
  } finally {
    await close();
  }
});

test("create survey uses the official list respondent origin when get_survey omits its link", async () => {
  const { client, close } = await connectClient();
  try {
    await withMockFetch((call) => {
      if (call.action === "1000106") return { result: true, data: { vid: 810003 } };
      if (call.action === "1000001") {
        return {
          result: true,
          data: {
            vid: 810003,
            title: "列表链接回退",
            status: 1,
            questions: [{ q_index: 1, q_type: 3, q_subtype: 3, q_title: "Q" }],
          },
        };
      }
      if (call.action === "1000002") {
        return {
          result: true,
          data: {
            page_index: 1,
            page_size: 50,
            total_count: 1,
            activitys: {
              "810003": {
                vid: 810003,
                sid: "mcpOfficialFallbackSid",
                activity_domain: "https://ks.wjx.com",
                pc_path: "/m/mcpOfficialFallbackSid.aspx",
              },
            },
          },
        };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "create_survey_by_json",
        arguments: {
          jsonl: [
            '{"qtype":"问卷基础信息","title":"列表链接回退"}',
            '{"qtype":"单选","title":"Q","select":["A","B"]}',
          ].join("\n"),
          atype: 1,
        },
      });
      assert.equal(result.isError, false, JSON.stringify(result));
      const payload = parse(result);
      assert.equal(payload.outcome, "verified");
      assert.equal(payload.data.verification.link, true);
      assert.equal(payload.data.fillUrl, "https://ks.wjx.com/m/mcpOfficialFallbackSid.aspx");
      assert.deepEqual(calls.map((entry) => entry.action), ["1000106", "1000001", "1000002"]);
    });
  } finally {
    await close();
  }
});

test("create survey accepts a wjx.top respondent origin from the list fallback", async () => {
  const { client, close } = await connectClient("create-wjx-top-fallback");
  try {
    await withMockFetch((call) => {
      if (call.action === "1000106") {
        return { result: true, data: { vid: 810004 } };
      }
      if (call.action === "1000001") {
        return {
          result: true,
          data: {
            vid: 810004,
            title: "top fallback",
            status: 1,
            questions: [{ q_index: 1, q_type: 3, q_subtype: 3, q_title: "Q" }],
          },
        };
      }
      if (call.action === "1000002") {
        return {
          result: true,
          data: {
            page_index: 1,
            page_size: 50,
            total_count: 1,
            activitys: {
              "810004": {
                vid: 810004,
                sid: "topMcpFallbackSid",
                activity_domain: "https://www.wjx.top",
                pc_path: "/vm/topMcpFallbackSid.aspx",
              },
            },
          },
        };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "create_survey_by_json",
        arguments: {
          jsonl: [
            JSON.stringify({ qtype: "问卷基础信息", title: "top fallback" }),
            JSON.stringify({ qtype: "单选", title: "Q", select: ["A", "B"] }),
          ].join("\n"),
        },
      });
      assert.equal(result.isError, false, JSON.stringify(result));
      const payload = parse(result);
      assert.equal(payload.outcome, "verified");
      assert.equal(payload.data.fillUrl, "https://www.wjx.top/vm/topMcpFallbackSid.aspx");
      assert.deepEqual(calls.map((entry) => entry.action), ["1000106", "1000001", "1000002"]);
    });
  } finally {
    await close();
  }
});

test("response submit and clear return count/identity verification", async () => {
  const { client, close } = await connectClient();
  let responseCount = 2;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") return survey(1);
      if (call.action === "1001001") return { result: true, data: { jid: 901 } };
      if (call.action === "1001002") {
        return {
          result: true,
          data: {
            total_count: responseCount,
            responses: responseCount ? [{ jid: 901 }] : [],
          },
        };
      }
      if (call.action === "1001201") {
        responseCount = 0;
        return { result: true, data: { cleared: 2 } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const submitted = await client.callTool({
        name: "submit_response",
        arguments: { vid: 810001, inputcosttime: 30, submitdata: "1$2", jpmversion: 3 },
      });
      assert.equal(submitted.isError, false);
      const submittedPayload = parse(submitted);
      assert.equal(submittedPayload.outcome, "verified");
      assert.equal(submittedPayload.data.verification.structure, true);
      assert.equal(submittedPayload.data.verification.count, true);

      const cleared = await client.callTool({
        name: "clear_responses",
        arguments: { username: "owner", vid: 810001, reset_to_zero: false },
      });
      assert.equal(cleared.isError, false);
      const clearedPayload = parse(cleared);
      assert.equal(clearedPayload.outcome, "verified");
      assert.equal(clearedPayload.data.verification.count, true);
      assert.deepEqual(calls.map((entry) => entry.action), [
        "1000001", "1001001", "1001002",
        "1001002", "1001201", "1001002",
      ]);
    });
  } finally {
    await close();
  }
});

test("clear responses stops before writing when response counts are null", async () => {
  const { client, close } = await connectClient("clear-responses-null-count");
  let clearCalls = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") return survey(1);
      if (call.action === "1001002") return { result: true, data: { total_count: null, join_times: null } };
      if (call.action === "1001201") {
        clearCalls += 1;
        return { result: true, data: { cleared: true } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "clear_responses",
        arguments: { username: "owner", vid: 810001, reset_to_zero: false },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.match(payload.errormsg, /清空前|答卷总数|停止/);
      assert.equal(clearCalls, 0);
      assert.deepEqual(calls.map((entry) => entry.action), ["1001002"]);
    });
  } finally {
    await close();
  }
});

test("clear responses stops before writing when response counts are empty", async () => {
  const { client, close } = await connectClient("clear-responses-empty-count");
  let clearCalls = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1001002") return { result: true, data: { total_count: "", join_times: "" } };
      if (call.action === "1001201") {
        clearCalls += 1;
        return { result: true, data: { cleared: true } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "clear_responses",
        arguments: { username: "owner", vid: 810001, reset_to_zero: false },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.match(payload.errormsg, /清空前|答卷总数|停止/);
      assert.equal(clearCalls, 0);
      assert.deepEqual(calls.map((entry) => entry.action), ["1001002"]);
    });
  } finally {
    await close();
  }
});

test("count responses preserves null counters instead of inventing zero", async () => {
  const { client, close } = await connectClient("count-responses-null");
  try {
    await withMockFetch((call) => {
      if (call.action === "1001002") return { result: true, data: { total_count: null, join_times: null } };
      return { result: true, data: {} };
    }, async () => {
      const result = await client.callTool({
        name: "count_responses",
        arguments: { vid: 810001 },
      });
      assert.equal(result.isError, false);
      const payload = parse(result);
      assert.equal(payload.result, true);
      assert.equal(payload.total_count, null);
      assert.equal(payload.join_times, null);
    });
  } finally {
    await close();
  }
});

test("a successful write with an unverifiable post-state is an MCP unknown error", async () => {
  const { client, close } = await connectClient();
  try {
    await withMockFetch((call) => {
      if (call.action === "1000001") return survey(1);
      if (call.action === "1001001") return { result: true, data: { jid: 902 } };
      if (call.action === "1001002") return { throw: new TypeError("network connection lost") };
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "submit_response",
        arguments: { vid: 810001, inputcosttime: 30, submitdata: "1$2", jpmversion: 3 },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.result, false);
      assert.equal(payload.outcome, "unknown");
      assert.equal(payload.data.outcome, "unknown");
      assert.equal(payload.data.verification.count, false);
      assert.ok(payload.verificationRequired?.length > 0);
      // query_responses is explicitly safe and uses the SDK default retry
      // budget (two retries after the first attempt) when the transport fails.
      assert.deepEqual(calls.map((entry) => entry.action), [
        "1000001", "1001001", "1001002", "1001002", "1001002",
      ]);
    });
  } finally {
    await close();
  }
});

function modifiedResponseRow(jid, score, includeScore = true) {
  return {
    jid,
    answer_items: includeScore
      ? { "10000": { q_index: 1, item_value: score } }
      : {},
  };
}

test("modify_response verifies the requested score after an unsafe write", async () => {
  const { client, close } = await connectClient("modify-response-success");
  let score = "5";
  try {
    await withMockFetch((call) => {
      if (call.action === "1001002") {
        return { result: true, data: { answers: { "1": modifiedResponseRow(777, score) } } };
      }
      if (call.action === "1001007") {
        score = JSON.parse(call.body.answers)["10000"];
        return { result: true, data: { saved: true, audit_id: "audit-1" } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "modify_response",
        arguments: { vid: 810001, jid: 777, type: 1, answers: JSON.stringify({ "10000": "8" }) },
      });
      assert.equal(result.isError, false);
      const payload = parse(result);
      assert.equal(payload.result, true);
      assert.equal(payload.outcome, "verified");
      assert.equal(payload.data.verification.structure, true);
      assert.equal(payload.data.verification.status, true);
      assert.equal(payload.data.answers["10000"], "8");
      assert.deepEqual(calls.map((entry) => entry.action), ["1001002", "1001007", "1001002"]);
    });
  } finally {
    await close();
  }
});

test("modify_response verifies item_value fields returned by query_responses", async () => {
  const { client, close } = await connectClient("modify-response-item-value");
  let score = 5;
  try {
    await withMockFetch((call) => {
      if (call.action === "1001002") {
        return {
          result: true,
          data: {
            answers: {
              "1": {
                jid: 778,
                answer_items: {
                  "10000": { q_index: 1, item_value: score },
                },
              },
            },
          },
        };
      }
      if (call.action === "1001007") {
        score = Number(JSON.parse(call.body.answers)["10000"]);
        return { result: true, data: { saved: true } };
      }
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "modify_response",
        arguments: { vid: 810001, jid: 778, type: 1, answers: JSON.stringify({ "10000": "8" }) },
      });
      assert.equal(result.isError, false, JSON.stringify(result));
      const payload = parse(result);
      assert.equal(payload.outcome, "verified");
      assert.equal(payload.data.answers["10000"], 8);
      assert.deepEqual(calls.map((entry) => entry.action), ["1001002", "1001007", "1001002"]);
    });
  } finally {
    await close();
  }
});

test("modify_response stops before writing when the target response is absent", async () => {
  const { client, close } = await connectClient("modify-response-missing-target");
  let writeCalled = false;
  try {
    await withMockFetch((call) => {
      if (call.action === "1001002") {
        return { result: true, data: { answers: { "1": modifiedResponseRow(778, "5") } } };
      }
      if (call.action === "1001007") writeCalled = true;
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "modify_response",
        arguments: { vid: 810001, jid: 777, type: 1, answers: JSON.stringify({ "10000": "8" }) },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.result, false);
      assert.match(payload.errormsg, /未找到|停止修改/);
      assert.equal(writeCalled, false);
      assert.deepEqual(calls.map((entry) => entry.action), ["1001002"]);
    });
  } finally {
    await close();
  }
});

test("modify_response reports unknown when the post-read omits the requested score", async () => {
  const { client, close } = await connectClient("modify-response-missing-score");
  let queryCount = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1001002") {
        queryCount += 1;
        return {
          result: true,
          data: { answers: { "1": modifiedResponseRow(777, "5", queryCount === 1) } },
        };
      }
      if (call.action === "1001007") return { result: true, data: { saved: true } };
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "modify_response",
        arguments: { vid: 810001, jid: 777, type: 1, answers: JSON.stringify({ "10000": "8" }) },
      });
      assert.equal(result.isError, true);
      const payload = parse(result);
      assert.equal(payload.result, false);
      assert.equal(payload.outcome, "unknown");
      assert.equal(payload.data.saved, true, "the original write response must be preserved");
      assert.match(payload.data.warnings.join(";"), /缺少可验证/);
      assert.deepEqual(calls.map((entry) => entry.action), ["1001002", "1001007", "1001002"]);
    });
  } finally {
    await close();
  }
});

test("modify_response resolves an ambiguous transport result through read-back", async () => {
  const { client, close } = await connectClient("modify-response-ambiguous");
  let queryCount = 0;
  try {
    await withMockFetch((call) => {
      if (call.action === "1001002") {
        queryCount += 1;
        return { result: true, data: { answers: { "1": modifiedResponseRow(777, queryCount === 1 ? "5" : "8") } } };
      }
      if (call.action === "1001007") return { throw: new TypeError("network connection lost") };
      return { result: true, data: {} };
    }, async (calls) => {
      const result = await client.callTool({
        name: "modify_response",
        arguments: { vid: 810001, jid: 777, type: 1, answers: JSON.stringify({ "10000": "8" }) },
      });
      assert.equal(result.isError, false);
      const payload = parse(result);
      assert.equal(payload.result, true);
      assert.equal(payload.outcome, "verified");
      assert.equal(payload.action, "1001007");
      assert.equal(payload.attempts, 1);
      assert.ok(payload.data.warnings.some((warning) => /传输结果不明确/.test(warning)));
      assert.deepEqual(calls.map((entry) => entry.action), ["1001002", "1001007", "1001002"]);
    });
  } finally {
    await close();
  }
});
