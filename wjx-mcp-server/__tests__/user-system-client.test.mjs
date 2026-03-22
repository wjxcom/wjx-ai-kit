import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addParticipants,
  modifyParticipants,
  deleteParticipants,
  querySurveyBinding,
  queryUserSurveys,
} from "../dist/modules/user-system/client.js";
import { WJX_USER_SYSTEM_API_URL, Action } from "../dist/core/constants.js";

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

// ─── addParticipants ────────────────────────────────────────────────

describe("addParticipants", () => {
  const input = { username: "user1", users: '[{"uid":"u1","name":"Alice"}]', usid: 100 };

  it("should POST to WJX_USER_SYSTEM_API_URL with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch, "1700000000");

    const { url, init } = fetch.captured();
    assert.ok(url.startsWith(WJX_USER_SYSTEM_API_URL), `URL should start with ${WJX_USER_SYSTEM_API_URL}`);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use action 1002001 (ADD_PARTICIPANTS)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_PARTICIPANTS);
    assert.equal(body.action, "1002001");
  });

  it("should include username, users, and usid in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "user1");
    assert.equal(body.users, '[{"uid":"u1","name":"Alice"}]');
    assert.equal(body.usid, 100);
  });

  it("should include sign as 40-char hex in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch, "1700000000");

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="), "URL should contain traceid query param");
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
      () => addParticipants(input, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "addParticipants should make exactly 1 request (no retries)");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { added: 1 } };
    const result = await addParticipants(input, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => addParticipants(input, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should include appid in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.appid, "test-app");
  });

  it("should NOT include appKey in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false, "appKey should never be in request body");
    assert.equal("appkey" in body, false, "appkey should never be in request body");
  });
});

// ─── modifyParticipants ─────────────────────────────────────────────

describe("modifyParticipants", () => {
  const input = { username: "user2", users: '[{"uid":"u2","name":"Bob"}]', usid: 200 };

  it("should POST to WJX_USER_SYSTEM_API_URL with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyParticipants(input, credentials, fetch, "1700000000");

    const { url, init } = fetch.captured();
    assert.ok(url.startsWith(WJX_USER_SYSTEM_API_URL), `URL should start with ${WJX_USER_SYSTEM_API_URL}`);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use action 1002002 (MODIFY_PARTICIPANTS)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyParticipants(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.MODIFY_PARTICIPANTS);
    assert.equal(body.action, "1002002");
  });

  it("should include username, users, and usid in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyParticipants(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "user2");
    assert.equal(body.users, '[{"uid":"u2","name":"Bob"}]');
    assert.equal(body.usid, 200);
  });

  it("should include sign as 40-char hex in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyParticipants(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyParticipants(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
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
      () => modifyParticipants(input, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "modifyParticipants should make exactly 1 request (no retries)");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { modified: 1 } };
    const result = await modifyParticipants(input, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => modifyParticipants(input, credentials, mockFetch("err", 404), "100"),
      /WJX API request failed with 404/,
    );
  });

  it("should NOT include appKey in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyParticipants(input, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false, "appKey should never be in request body");
    assert.equal("appkey" in body, false, "appkey should never be in request body");
  });
});

// ─── deleteParticipants ─────────────────────────────────────────────

describe("deleteParticipants", () => {
  const input = { username: "user3", uids: "uid1,uid2,uid3", usid: 300 };

  it("should POST to WJX_USER_SYSTEM_API_URL with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteParticipants(input, credentials, fetch, "1700000000");

    const { url, init } = fetch.captured();
    assert.ok(url.startsWith(WJX_USER_SYSTEM_API_URL), `URL should start with ${WJX_USER_SYSTEM_API_URL}`);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use action 1002003 (DELETE_PARTICIPANTS)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteParticipants(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.DELETE_PARTICIPANTS);
    assert.equal(body.action, "1002003");
  });

  it("should include username, uids, and usid in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteParticipants(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "user3");
    assert.equal(body.uids, "uid1,uid2,uid3");
    assert.equal(body.usid, 300);
  });

  it("should include sign as 40-char hex in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteParticipants(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteParticipants(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
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
      () => deleteParticipants(input, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "deleteParticipants should make exactly 1 request (no retries)");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { deleted: 3 } };
    const result = await deleteParticipants(input, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => deleteParticipants(input, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should NOT include appKey in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteParticipants(input, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false, "appKey should never be in request body");
    assert.equal("appkey" in body, false, "appkey should never be in request body");
  });

  it("should pass uids (not users) in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteParticipants(input, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("uids" in body, "body should contain uids field");
    assert.equal("users" in body, false, "body should NOT contain users field");
  });
});

// ─── querySurveyBinding ─────────────────────────────────────────────

describe("querySurveyBinding", () => {
  const input = { username: "user4", vid: 12345, usid: 400 };

  it("should POST to WJX_USER_SYSTEM_API_URL with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(input, credentials, fetch, "1700000000");

    const { url, init } = fetch.captured();
    assert.ok(url.startsWith(WJX_USER_SYSTEM_API_URL), `URL should start with ${WJX_USER_SYSTEM_API_URL}`);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use action 1002005 (QUERY_SURVEY_BINDING)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.QUERY_SURVEY_BINDING);
    assert.equal(body.action, "1002005");
  });

  it("should include username, vid, and usid in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "user4");
    assert.equal(body.vid, 12345);
    assert.equal(body.usid, 400);
  });

  it("should include sign as 40-char hex in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should include optional pagination when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(
      { ...input, page_index: 2, page_size: 20 },
      credentials,
      fetch,
      "1700000000",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.page_index, 2);
    assert.equal(body.page_size, 20);
  });

  it("should not include pagination fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("page_index" in body, false, "page_index should not be in body when not provided");
    assert.equal("page_size" in body, false, "page_size should not be in body when not provided");
  });

  it("should retry on 500 (read operation, default maxRetries=2)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      if (callCount < 3) {
        return new Response("err", { status: 500, statusText: "Error" });
      }
      return new Response(JSON.stringify({ result: true, data: { bindings: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await querySurveyBinding(input, credentials, fetch, "100");
    assert.equal(callCount, 3, "should have retried twice before succeeding");
    assert.deepEqual(result, { result: true, data: { bindings: [] } });
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { total: 5, bindings: [] } };
    const result = await querySurveyBinding(input, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });

  it("should NOT include appKey in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(input, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false, "appKey should never be in request body");
    assert.equal("appkey" in body, false, "appkey should never be in request body");
  });
});

// ─── queryUserSurveys ───────────────────────────────────────────────

describe("queryUserSurveys", () => {
  const input = { username: "user5", uid: "uid-abc-123", usid: 500 };

  it("should POST to WJX_USER_SYSTEM_API_URL with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryUserSurveys(input, credentials, fetch, "1700000000");

    const { url, init } = fetch.captured();
    assert.ok(url.startsWith(WJX_USER_SYSTEM_API_URL), `URL should start with ${WJX_USER_SYSTEM_API_URL}`);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use action 1002006 (QUERY_USER_SURVEYS)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryUserSurveys(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.QUERY_USER_SURVEYS);
    assert.equal(body.action, "1002006");
  });

  it("should include username, uid, and usid in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryUserSurveys(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "user5");
    assert.equal(body.uid, "uid-abc-123");
    assert.equal(body.usid, 500);
  });

  it("should include sign as 40-char hex in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryUserSurveys(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryUserSurveys(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should include optional pagination when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryUserSurveys(
      { ...input, page_index: 3, page_size: 50 },
      credentials,
      fetch,
      "1700000000",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.page_index, 3);
    assert.equal(body.page_size, 50);
  });

  it("should not include pagination fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryUserSurveys(input, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("page_index" in body, false, "page_index should not be in body when not provided");
    assert.equal("page_size" in body, false, "page_size should not be in body when not provided");
  });

  it("should retry on 500 (read operation, default maxRetries=2)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      if (callCount < 3) {
        return new Response("err", { status: 500, statusText: "Error" });
      }
      return new Response(JSON.stringify({ result: true, data: { surveys: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await queryUserSurveys(input, credentials, fetch, "100");
    assert.equal(callCount, 3, "should have retried twice before succeeding");
    assert.deepEqual(result, { result: true, data: { surveys: [] } });
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { total: 10, surveys: [] } };
    const result = await queryUserSurveys(input, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });

  it("should return parsed API error response", async () => {
    const mockResponse = { result: false, errormsg: "user not found" };
    const result = await queryUserSurveys(input, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });

  it("should NOT include appKey in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryUserSurveys(input, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false, "appKey should never be in request body");
    assert.equal("appkey" in body, false, "appkey should never be in request body");
  });
});

// ─── constants ──────────────────────────────────────────────────────

describe("user-system constants", () => {
  it("WJX_USER_SYSTEM_API_URL should be the usersystem endpoint", () => {
    assert.equal(WJX_USER_SYSTEM_API_URL, "https://www.wjx.cn/openapi/usersystem.aspx");
  });

  it("should export all user-system action codes", () => {
    assert.equal(Action.ADD_PARTICIPANTS, "1002001");
    assert.equal(Action.MODIFY_PARTICIPANTS, "1002002");
    assert.equal(Action.DELETE_PARTICIPANTS, "1002003");
    assert.equal(Action.QUERY_SURVEY_BINDING, "1002005");
    assert.equal(Action.QUERY_USER_SURVEYS, "1002006");
  });
});

// ─── cross-function: sign determinism ───────────────────────────────

describe("sign determinism", () => {
  it("same input produces different signs for different timestamps", async () => {
    const input = { username: "u", users: "[]", usid: 1 };
    const fetch1 = mockFetch({ result: true, data: {} });
    const fetch2 = mockFetch({ result: true, data: {} });

    await addParticipants(input, credentials, fetch1, "100");
    await addParticipants(input, credentials, fetch2, "200");

    const body1 = JSON.parse(fetch1.captured().init.body);
    const body2 = JSON.parse(fetch2.captured().init.body);
    assert.notEqual(body1.sign, body2.sign);
  });

  it("same input produces different signs for different appKeys", async () => {
    const input = { username: "u", users: "[]", usid: 1 };
    const cred1 = { appId: "app", appKey: "key1" };
    const cred2 = { appId: "app", appKey: "key2" };
    const fetch1 = mockFetch({ result: true, data: {} });
    const fetch2 = mockFetch({ result: true, data: {} });

    await addParticipants(input, cred1, fetch1, "100");
    await addParticipants(input, cred2, fetch2, "100");

    const body1 = JSON.parse(fetch1.captured().init.body);
    const body2 = JSON.parse(fetch2.captured().init.body);
    assert.notEqual(body1.sign, body2.sign);
  });
});
