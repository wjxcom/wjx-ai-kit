import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addSubAccount,
  modifySubAccount,
  deleteSubAccount,
  restoreSubAccount,
  querySubAccounts,
} from "../dist/modules/multi-user/client.js";

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

// ─── addSubAccount ──────────────────────────────────────────────────

describe("addSubAccount", () => {
  it("should POST with action 1003001 and required fields", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount(
      { subuser: "sub1", password: "pass123" },
      credentials,
      fetch,
      "1700000000",
    );

    const { url, init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");

    const body = JSON.parse(init.body);
    assert.equal(body.action, "1003001");
    assert.equal(body.subuser, "sub1");
    assert.equal(body.password, "pass123");
    assert.equal(body.appid, "test-app");
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should use subuser.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "1700000000",
    );

    const url = fetch.captured().url;
    assert.ok(url.includes("subuser.aspx"), "URL should use subuser.aspx endpoint");
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount(
      { subuser: "sub1", password: "pass123" },
      credentials,
      fetch,
      "1700000000",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount(
      { subuser: "sub1", password: "pass123" },
      credentials,
      fetch,
      "1700000000",
    );

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="), "URL should contain traceid query param");
  });

  it("should NOT send username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not be in body");
  });

  it("should include optional mobile when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount(
      { subuser: "sub1", mobile: "13800138000" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.mobile, "13800138000");
  });

  it("should include optional email when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount(
      { subuser: "sub1", email: "sub@test.com" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.email, "sub@test.com");
  });

  it("should include optional role when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount(
      { subuser: "sub1", role: 2 },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.role, 2);
  });

  it("should include optional group when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount(
      { subuser: "sub1", group: 5 },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.group, 5);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("mobile" in body, false);
    assert.equal("email" in body, false);
    assert.equal("role" in body, false);
    assert.equal("group" in body, false);
    assert.equal("password" in body, false);
  });

  it("should NOT retry on 500 (maxRetries=0)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("Server Error"), {
        status: 500,
        statusText: "Internal Server Error",
      });
    };

    await assert.rejects(
      () =>
        addSubAccount(
          { subuser: "sub1", password: "pass123" },
          credentials,
          fetch,
          "100",
        ),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "addSubAccount should make exactly 1 request (no retries)");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { userId: 42 } };
    const result = await addSubAccount(
      { subuser: "sub1", password: "pass123" },
      credentials,
      mockFetch(mockResponse),
      "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should return parsed API error response", async () => {
    const mockResponse = { result: false, errormsg: "用户名已存在" };
    const result = await addSubAccount(
      { subuser: "sub1", password: "pass123" },
      credentials,
      mockFetch(mockResponse),
      "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () =>
        addSubAccount(
          { subuser: "sub1", password: "pass123" },
          credentials,
          mockFetch("Not Found", 404),
          "100",
        ),
      /WJX API request failed with 404/,
    );
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount(
      { subuser: "sub1", password: "pass123" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false, "appKey should never be in request body");
    assert.equal("appkey" in body, false, "appkey should never be in request body");
  });
});

// ─── modifySubAccount ───────────────────────────────────────────────

describe("modifySubAccount", () => {
  it("should POST with action 1003002 and required fields", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "1700000000",
    );

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");

    const body = JSON.parse(init.body);
    assert.equal(body.action, "1003002");
    assert.equal(body.subuser, "sub1");
    assert.equal(body.appid, "test-app");
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should use subuser.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const url = fetch.captured().url;
    assert.ok(url.includes("subuser.aspx"), "URL should use subuser.aspx endpoint");
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT send username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not be in body");
  });

  it("should include optional group when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount(
      { subuser: "sub1", group: 5 },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.group, 5);
  });

  it("should include optional mobile when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount(
      { subuser: "sub1", mobile: "13900139000" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.mobile, "13900139000");
  });

  it("should include optional email when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount(
      { subuser: "sub1", email: "new@test.com" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.email, "new@test.com");
  });

  it("should include optional role when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount(
      { subuser: "sub1", role: 3 },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.role, 3);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("mobile" in body, false);
    assert.equal("email" in body, false);
    assert.equal("role" in body, false);
    assert.equal("group" in body, false);
  });

  it("should NOT retry on 500 (maxRetries=0)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () =>
        modifySubAccount(
          { subuser: "sub1" },
          credentials,
          fetch,
          "100",
        ),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "modifySubAccount should make exactly 1 request (no retries)");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });
});

// ─── deleteSubAccount ───────────────────────────────────────────────

describe("deleteSubAccount", () => {
  it("should POST with action 1003003 and required fields", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "1700000000",
    );

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");

    const body = JSON.parse(init.body);
    assert.equal(body.action, "1003003");
    assert.equal(body.subuser, "sub1");
    assert.equal(body.appid, "test-app");
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should use subuser.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const url = fetch.captured().url;
    assert.ok(url.includes("subuser.aspx"), "URL should use subuser.aspx endpoint");
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT send username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not be in body");
  });

  it("should NOT retry on 500 (maxRetries=0)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () =>
        deleteSubAccount(
          { subuser: "sub1" },
          credentials,
          fetch,
          "100",
        ),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "deleteSubAccount should make exactly 1 request (no retries)");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await deleteSubAccount(
      { subuser: "sub1" },
      credentials,
      mockFetch(mockResponse),
      "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () =>
        deleteSubAccount(
          { subuser: "sub1" },
          credentials,
          mockFetch("err", 500),
          "100",
        ),
      /WJX API request failed with 500/,
    );
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });
});

// ─── restoreSubAccount ──────────────────────────────────────────────

describe("restoreSubAccount", () => {
  it("should POST with action 1003004 and required fields", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "1700000000",
    );

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");

    const body = JSON.parse(init.body);
    assert.equal(body.action, "1003004");
    assert.equal(body.subuser, "sub1");
    assert.equal(body.appid, "test-app");
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should use subuser.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const url = fetch.captured().url;
    assert.ok(url.includes("subuser.aspx"), "URL should use subuser.aspx endpoint");
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT send username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not be in body");
  });

  it("should include optional mobile when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreSubAccount(
      { subuser: "sub1", mobile: "13800138000" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.mobile, "13800138000");
  });

  it("should include optional email when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreSubAccount(
      { subuser: "sub1", email: "restore@test.com" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.email, "restore@test.com");
  });

  it("should NOT retry on 500 (maxRetries=0)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () =>
        restoreSubAccount(
          { subuser: "sub1" },
          credentials,
          fetch,
          "100",
        ),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "restoreSubAccount should make exactly 1 request (no retries)");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { restored: true } };
    const result = await restoreSubAccount(
      { subuser: "sub1" },
      credentials,
      mockFetch(mockResponse),
      "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () =>
        restoreSubAccount(
          { subuser: "sub1" },
          credentials,
          mockFetch("err", 404),
          "100",
        ),
      /WJX API request failed with 404/,
    );
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });
});

// ─── querySubAccounts ───────────────────────────────────────────────

describe("querySubAccounts", () => {
  it("should POST with action 1003005", async () => {
    const fetch = mockFetch({ result: true, data: { total_count: 0 } });
    await querySubAccounts(
      {},
      credentials,
      fetch,
      "1700000000",
    );

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");

    const body = JSON.parse(init.body);
    assert.equal(body.action, "1003005");
    assert.equal(body.appid, "test-app");
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should use subuser.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      {},
      credentials,
      fetch,
      "100",
    );

    const url = fetch.captured().url;
    assert.ok(url.includes("subuser.aspx"), "URL should use subuser.aspx endpoint");
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      {},
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      {},
      credentials,
      fetch,
      "100",
    );

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="), "URL should contain traceid query param");
  });

  it("should NOT send username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      {},
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not be in body");
  });

  it("should include optional subuser when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.subuser, "sub1");
  });

  it("should include optional name_like when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      { name_like: "test" },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.name_like, "test");
  });

  it("should include optional role when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      { role: 2 },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.role, 2);
  });

  it("should include optional group when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      { group: 3 },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.group, 3);
  });

  it("should include optional status when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      { status: true },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.status, true);
  });

  it("should include optional page_index when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      { page_index: 2 },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.page_index, 2);
  });

  it("should include optional page_size when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      { page_size: 50 },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.page_size, 50);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      {},
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("subuser" in body, false);
    assert.equal("name_like" in body, false);
    assert.equal("role" in body, false);
    assert.equal("group" in body, false);
    assert.equal("status" in body, false);
    assert.equal("page_index" in body, false);
    assert.equal("page_size" in body, false);
  });

  it("should retry on 500 (default maxRetries for read operation)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      if (callCount < 3) {
        return new Response("err", { status: 500, statusText: "Error" });
      }
      return new Response(JSON.stringify({ result: true, data: { total_count: 5 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await querySubAccounts(
      {},
      credentials,
      fetch,
      "100",
    );
    assert.equal(callCount, 3, "should have retried twice before succeeding");
    assert.deepEqual(result, { result: true, data: { total_count: 5 } });
  });

  it("should retry on 429 status", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("Rate limited", { status: 429, statusText: "Too Many Requests" });
      }
      return new Response(JSON.stringify({ result: true, data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await querySubAccounts(
      {},
      credentials,
      fetch,
      "100",
    );
    assert.equal(callCount, 2, "should have retried once after 429");
    assert.deepEqual(result, { result: true, data: {} });
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { total_count: 3, users: [] } };
    const result = await querySubAccounts(
      {},
      credentials,
      mockFetch(mockResponse),
      "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      {},
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });
});

// ─── URL action parameter ───────────────────────────────────────────

describe("URL action parameter", () => {
  it("addSubAccount URL should include action=1003001", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount(
      { subuser: "sub1", password: "p" },
      credentials,
      fetch,
      "100",
    );
    assert.ok(fetch.captured().url.includes("action=1003001"));
  });

  it("modifySubAccount URL should include action=1003002", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );
    assert.ok(fetch.captured().url.includes("action=1003002"));
  });

  it("deleteSubAccount URL should include action=1003003", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );
    assert.ok(fetch.captured().url.includes("action=1003003"));
  });

  it("restoreSubAccount URL should include action=1003004", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreSubAccount(
      { subuser: "sub1" },
      credentials,
      fetch,
      "100",
    );
    assert.ok(fetch.captured().url.includes("action=1003004"));
  });

  it("querySubAccounts URL should include action=1003005", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts(
      {},
      credentials,
      fetch,
      "100",
    );
    assert.ok(fetch.captured().url.includes("action=1003005"));
  });
});
