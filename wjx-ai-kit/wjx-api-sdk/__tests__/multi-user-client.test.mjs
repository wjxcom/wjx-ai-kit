import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addSubAccount,
  modifySubAccount,
  deleteSubAccount,
  restoreSubAccount,
  querySubAccounts,
} from "../dist/index.js";

const credentials = { token: "test-token" };

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

function assertBearerAuth(init, body) {
  assert.equal(init.headers["Authorization"], "Bearer test-token");
  assert.equal("sign" in body, false, "sign should not be in body");
  assert.equal("appid" in body, false, "appid should not be in body");
  assert.equal("ts" in body, false, "ts should not be in body");
}

// ─── addSubAccount ──────────────────────────────────────────────────

describe("addSubAccount", () => {
  it("should POST with action 1003001 and required fields with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount({ subuser: "sub1", password: "pass123" }, credentials, fetch);

    const { url, init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");

    const body = JSON.parse(init.body);
    assert.equal(body.action, "1003001");
    assert.equal(body.subuser, "sub1");
    assert.equal(body.password, "pass123");
    assertBearerAuth(init, body);
  });

  it("should use subuser.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount({ subuser: "sub1" }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("subuser.aspx"));
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount({ subuser: "sub1", password: "pass123" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false);
  });

  it("should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount({ subuser: "sub1", password: "pass123" }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="));
  });

  it("should NOT send username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount({ subuser: "sub1" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false);
  });

  it("should include optional mobile when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount({ subuser: "sub1", mobile: "13800138000" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.mobile, "13800138000");
  });

  it("should include optional email when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount({ subuser: "sub1", email: "sub@test.com" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.email, "sub@test.com");
  });

  it("should include optional role when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount({ subuser: "sub1", role: 2 }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.role, 2);
  });

  it("should include optional group when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount({ subuser: "sub1", group: 5 }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.group, 5);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount({ subuser: "sub1" }, credentials, fetch);

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
      return new Response(JSON.stringify("Server Error"), { status: 500, statusText: "Internal Server Error" });
    };

    await assert.rejects(
      () => addSubAccount({ subuser: "sub1", password: "pass123" }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { userId: 42 } };
    const result = await addSubAccount({ subuser: "sub1", password: "pass123" }, credentials, mockFetch(mockResponse));
    assert.deepEqual(result, mockResponse);
  });

  it("should return parsed API error response", async () => {
    const mockResponse = { result: false, errormsg: "用户名已存在" };
    const result = await addSubAccount({ subuser: "sub1", password: "pass123" }, credentials, mockFetch(mockResponse));
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => addSubAccount({ subuser: "sub1", password: "pass123" }, credentials, mockFetch("Not Found", 404)),
      /WJX API request failed with 404/,
    );
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount({ subuser: "sub1", password: "pass123" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });
});

// ─── modifySubAccount ───────────────────────────────────────────────

describe("modifySubAccount", () => {
  it("should POST with action 1003002 and Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount({ subuser: "sub1" }, credentials, fetch);

    const { init } = fetch.captured();
    const body = JSON.parse(init.body);
    assert.equal(body.action, "1003002");
    assert.equal(body.subuser, "sub1");
    assertBearerAuth(init, body);
  });

  it("should include optional fields when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount({ subuser: "sub1", group: 5, mobile: "139", email: "e@t.com", role: 3 }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.group, 5);
    assert.equal(body.mobile, "139");
    assert.equal(body.email, "e@t.com");
    assert.equal(body.role, 3);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount({ subuser: "sub1" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("mobile" in body, false);
    assert.equal("email" in body, false);
    assert.equal("role" in body, false);
    assert.equal("group" in body, false);
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => modifySubAccount({ subuser: "sub1" }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });
});

// ─── deleteSubAccount ───────────────────────────────────────────────

describe("deleteSubAccount", () => {
  it("should POST with action 1003003 and Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteSubAccount({ subuser: "sub1" }, credentials, fetch);

    const { init } = fetch.captured();
    const body = JSON.parse(init.body);
    assert.equal(body.action, "1003003");
    assert.equal(body.subuser, "sub1");
    assertBearerAuth(init, body);
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => deleteSubAccount({ subuser: "sub1" }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await deleteSubAccount({ subuser: "sub1" }, credentials, mockFetch(mockResponse));
    assert.deepEqual(result, mockResponse);
  });
});

// ─── restoreSubAccount ──────────────────────────────────────────────

describe("restoreSubAccount", () => {
  it("should POST with action 1003004 and Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreSubAccount({ subuser: "sub1" }, credentials, fetch);

    const { init } = fetch.captured();
    const body = JSON.parse(init.body);
    assert.equal(body.action, "1003004");
    assert.equal(body.subuser, "sub1");
    assertBearerAuth(init, body);
  });

  it("should include optional mobile when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreSubAccount({ subuser: "sub1", mobile: "13800138000" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.mobile, "13800138000");
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => restoreSubAccount({ subuser: "sub1" }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { restored: true } };
    const result = await restoreSubAccount({ subuser: "sub1" }, credentials, mockFetch(mockResponse));
    assert.deepEqual(result, mockResponse);
  });
});

// ─── querySubAccounts ───────────────────────────────────────────────

describe("querySubAccounts", () => {
  it("should POST with action 1003005 and Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: { total_count: 0 } });
    await querySubAccounts({}, credentials, fetch);

    const { init } = fetch.captured();
    const body = JSON.parse(init.body);
    assert.equal(body.action, "1003005");
    assertBearerAuth(init, body);
  });

  it("should include optional params when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts({ subuser: "sub1", name_like: "test", role: 2, group: 3, status: true, page_index: 2, page_size: 50 }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.subuser, "sub1");
    assert.equal(body.name_like, "test");
    assert.equal(body.role, 2);
    assert.equal(body.group, 3);
    assert.equal(body.status, true);
    assert.equal(body.page_index, 2);
    assert.equal(body.page_size, 50);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts({}, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("subuser" in body, false);
    assert.equal("name_like" in body, false);
    assert.equal("role" in body, false);
    assert.equal("group" in body, false);
    assert.equal("status" in body, false);
    assert.equal("page_index" in body, false);
    assert.equal("page_size" in body, false);
  });

  it("should retry on 500 (default maxRetries for read)", async () => {
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

    const result = await querySubAccounts({}, credentials, fetch);
    assert.equal(callCount, 3);
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

    const result = await querySubAccounts({}, credentials, fetch);
    assert.equal(callCount, 2);
    assert.deepEqual(result, { result: true, data: {} });
  });
});

// ─── URL action parameter ───────────────────────────────────────────

describe("URL action parameter", () => {
  it("addSubAccount URL should include action=1003001", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addSubAccount({ subuser: "sub1", password: "p" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1003001"));
  });

  it("modifySubAccount URL should include action=1003002", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifySubAccount({ subuser: "sub1" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1003002"));
  });

  it("deleteSubAccount URL should include action=1003003", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteSubAccount({ subuser: "sub1" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1003003"));
  });

  it("restoreSubAccount URL should include action=1003004", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreSubAccount({ subuser: "sub1" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1003004"));
  });

  it("querySubAccounts URL should include action=1003005", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts({}, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1003005"));
  });
});
