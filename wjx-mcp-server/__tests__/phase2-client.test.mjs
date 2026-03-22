import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getTagDetails, clearRecycleBin } from "../dist/modules/survey/client.js";
import { getWinners, modifyResponse, get360Report, clearResponses } from "../dist/modules/response/client.js";

const credentials = { appId: "test-app", appKey: "test-key" };

function mockFetch(responseBody, status = 200) {
  let capturedUrl, capturedInit;
  const fn = async (input, init) => {
    capturedUrl = input;
    capturedInit = init;
    return new Response(JSON.stringify(responseBody), {
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: { "Content-Type": "application/json" },
    });
  };
  fn.captured = () => ({ url: capturedUrl, init: capturedInit });
  return fn;
}

// ─── getTagDetails ──────────────────────────────────────────────────

describe("getTagDetails", () => {
  it("should POST with action 1000005 and tag_id", async () => {
    const fetch = mockFetch({ result: true, data: { tag_id: 42 } });
    await getTagDetails({ tag_id: 42 }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    const body = JSON.parse(init.body);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(body.action, "1000005");
    assert.equal(body.tag_id, 42);
    assert.equal(body.appid, "test-app");
  });

  it("should include sign as 40-char hex", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getTagDetails({ tag_id: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body, "body should have sign field");
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getTagDetails({ tag_id: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getTagDetails({ tag_id: 1 }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="), "URL should contain traceid query param");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { tag_id: 7, questions: [] } };
    const result = await getTagDetails({ tag_id: 7 }, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });

  it("should retry on 500 (read operation, default maxRetries)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      if (callCount < 3) {
        return new Response("err", { status: 500, statusText: "Error" });
      }
      return new Response(JSON.stringify({ result: true, data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await getTagDetails({ tag_id: 1 }, credentials, fetch, "100");
    assert.equal(callCount, 3, "should have retried twice before succeeding");
    assert.deepEqual(result, { result: true, data: {} });
  });
});

// ─── clearRecycleBin ────────────────────────────────────────────────

describe("clearRecycleBin", () => {
  it("should POST with action 1000302 and username", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await clearRecycleBin({ username: "user@example.com" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    const body = JSON.parse(init.body);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(body.action, "1000302");
    assert.equal(body.username, "user@example.com");
    assert.equal(body.appid, "test-app");
  });

  it("should include sign as 40-char hex", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await clearRecycleBin({ username: "u" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await clearRecycleBin({ username: "u" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should pass optional vid when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await clearRecycleBin({ username: "u", vid: 999 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.vid, 999);
  });

  it("should not include vid when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await clearRecycleBin({ username: "u" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("vid" in body, false, "vid should not be in body when not provided");
  });

  it("should NOT retry on 500 (maxRetries=0, destructive write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("Server Error"), {
        status: 500,
        statusText: "Internal Server Error",
      });
    };

    await assert.rejects(
      () => clearRecycleBin({ username: "u" }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "clearRecycleBin should make exactly 1 request (no retries)");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { deleted: 3 } };
    const result = await clearRecycleBin({ username: "u" }, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });
});

// ─── getWinners ─────────────────────────────────────────────────────

describe("getWinners", () => {
  it("should POST with action 1004001 and vid", async () => {
    const fetch = mockFetch({ result: true, data: { winners: [] } });
    await getWinners({ vid: 12345 }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    const body = JSON.parse(init.body);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(body.action, "1004001");
    assert.equal(body.vid, 12345);
    assert.equal(body.appid, "test-app");
  });

  it("should include sign as 40-char hex", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getWinners({ vid: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getWinners({ vid: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getWinners({ vid: 1 }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="), "URL should contain traceid query param");
  });

  it("should pass optional atype, awardstatus, page_index, page_size", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getWinners(
      { vid: 1, atype: 2, awardstatus: 1, page_index: 3, page_size: 20 },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.atype, 2);
    assert.equal(body.awardstatus, 1);
    assert.equal(body.page_index, 3);
    assert.equal(body.page_size, 20);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getWinners({ vid: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("atype" in body, false);
    assert.equal("awardstatus" in body, false);
    assert.equal("page_index" in body, false);
    assert.equal("page_size" in body, false);
  });

  it("should retry on 500 (read operation, default maxRetries)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      if (callCount < 3) {
        return new Response("err", { status: 500, statusText: "Error" });
      }
      return new Response(JSON.stringify({ result: true, data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await getWinners({ vid: 1 }, credentials, fetch, "100");
    assert.equal(callCount, 3, "should have retried twice before succeeding");
    assert.deepEqual(result, { result: true, data: {} });
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { winners: [{ jid: 1 }] } };
    const result = await getWinners({ vid: 1 }, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });
});

// ─── modifyResponse ─────────────────────────────────────────────────

describe("modifyResponse", () => {
  it("should POST with action 1001007, vid, jid, type, answers", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyResponse(
      { vid: 100, jid: 200, type: 1, answers: "1$1" },
      credentials,
      fetch,
      "1700000000",
    );

    const { init } = fetch.captured();
    const body = JSON.parse(init.body);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(body.action, "1001007");
    assert.equal(body.vid, 100);
    assert.equal(body.jid, 200);
    assert.equal(body.type, 1);
    assert.equal(body.answers, "1$1");
    assert.equal(body.appid, "test-app");
  });

  it("should include sign as 40-char hex", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyResponse({ vid: 1, jid: 2, type: 1, answers: "a" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyResponse({ vid: 1, jid: 2, type: 1, answers: "a" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT retry on 500 (maxRetries=0, write operation)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("Server Error"), {
        status: 500,
        statusText: "Internal Server Error",
      });
    };

    await assert.rejects(
      () => modifyResponse({ vid: 1, jid: 2, type: 1, answers: "a" }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "modifyResponse should make exactly 1 request (no retries)");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { modified: true } };
    const result = await modifyResponse(
      { vid: 1, jid: 2, type: 1, answers: "a" },
      credentials,
      mockFetch(mockResponse),
      "100",
    );
    assert.deepEqual(result, mockResponse);
  });
});

// ─── get360Report ───────────────────────────────────────────────────

describe("get360Report", () => {
  it("should POST with action 1001102 and vid", async () => {
    const fetch = mockFetch({ result: true, data: { report: {} } });
    await get360Report({ vid: 555 }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    const body = JSON.parse(init.body);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(body.action, "1001102");
    assert.equal(body.vid, 555);
    assert.equal(body.appid, "test-app");
  });

  it("should include sign as 40-char hex", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await get360Report({ vid: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await get360Report({ vid: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await get360Report({ vid: 1 }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="), "URL should contain traceid query param");
  });

  it("should pass optional taskid when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await get360Report({ vid: 1, taskid: 42 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.taskid, 42);
  });

  it("should not include taskid when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await get360Report({ vid: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("taskid" in body, false, "taskid should not be in body when not provided");
  });

  it("should retry on 500 (read operation, default maxRetries)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      if (callCount < 3) {
        return new Response("err", { status: 500, statusText: "Error" });
      }
      return new Response(JSON.stringify({ result: true, data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await get360Report({ vid: 1 }, credentials, fetch, "100");
    assert.equal(callCount, 3, "should have retried twice before succeeding");
    assert.deepEqual(result, { result: true, data: {} });
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { report: { scores: [90] } } };
    const result = await get360Report({ vid: 1 }, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });
});

// ─── clearResponses ─────────────────────────────────────────────────

describe("clearResponses", () => {
  it("should POST with action 1001201, username, vid, reset_to_zero", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await clearResponses(
      { username: "admin@test.com", vid: 777, reset_to_zero: true },
      credentials,
      fetch,
      "1700000000",
    );

    const { init } = fetch.captured();
    const body = JSON.parse(init.body);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(body.action, "1001201");
    assert.equal(body.username, "admin@test.com");
    assert.equal(body.vid, 777);
    assert.equal(body.reset_to_zero, true);
    assert.equal(body.appid, "test-app");
  });

  it("should include sign as 40-char hex", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await clearResponses({ username: "u", vid: 1, reset_to_zero: false }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await clearResponses({ username: "u", vid: 1, reset_to_zero: false }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT retry on 500 (maxRetries=0, destructive write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("Server Error"), {
        status: 500,
        statusText: "Internal Server Error",
      });
    };

    await assert.rejects(
      () => clearResponses({ username: "u", vid: 1, reset_to_zero: true }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "clearResponses should make exactly 1 request (no retries)");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { cleared: 50 } };
    const result = await clearResponses(
      { username: "u", vid: 1, reset_to_zero: false },
      credentials,
      mockFetch(mockResponse),
      "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should pass reset_to_zero as false", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await clearResponses({ username: "u", vid: 1, reset_to_zero: false }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.reset_to_zero, false);
  });
});
