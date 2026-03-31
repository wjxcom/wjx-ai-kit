import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addParticipants,
  modifyParticipants,
  deleteParticipants,
  querySurveyBinding,
  queryUserSurveys,
  getWjxUserSystemApiUrl,
  Action,
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

// ─── addParticipants ────────────────────────────────────────────────

describe("addParticipants", () => {
  const input = { username: "user1", users: '[{"uid":"u1","name":"Alice"}]', sysid: 100 };

  it("should POST to usersystem endpoint with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch);

    const { url, init } = fetch.captured();
    assert.ok(url.startsWith(getWjxUserSystemApiUrl()));
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use action 1002001 (ADD_PARTICIPANTS)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_PARTICIPANTS);
    assert.equal(body.action, "1002001");
  });

  it("should include username, users, and sysid in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "user1");
    assert.equal(body.users, '[{"uid":"u1","name":"Alice"}]');
    assert.equal(body.sysid, 100);
  });

  it("should use Bearer auth, no sign/appid/ts", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false);
  });

  it("should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="));
  });

  it("should NOT retry on 500 (maxRetries=0)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("Server Error"), { status: 500, statusText: "Internal Server Error" });
    };

    await assert.rejects(
      () => addParticipants(input, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { added: 1 } };
    const result = await addParticipants(input, credentials, mockFetch(mockResponse));
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => addParticipants(input, credentials, mockFetch("err", 500)),
      /WJX API request failed with 500/,
    );
  });

  it("should NOT include appKey in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addParticipants(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });
});

// ─── modifyParticipants ─────────────────────────────────────────────

describe("modifyParticipants", () => {
  const input = { username: "user2", users: '[{"uid":"u2","name":"Bob"}]', sysid: 200 };

  it("should use action 1002002 with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyParticipants(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.MODIFY_PARTICIPANTS);
    assert.equal(body.action, "1002002");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should include username, users, and sysid in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyParticipants(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "user2");
    assert.equal(body.users, '[{"uid":"u2","name":"Bob"}]');
    assert.equal(body.sysid, 200);
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => modifyParticipants(input, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { modified: 1 } };
    const result = await modifyParticipants(input, credentials, mockFetch(mockResponse));
    assert.deepEqual(result, mockResponse);
  });
});

// ─── deleteParticipants ─────────────────────────────────────────────

describe("deleteParticipants", () => {
  const input = { username: "user3", uids: '["uid1","uid2","uid3"]', sysid: 300 };

  it("should use action 1002003 with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteParticipants(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.DELETE_PARTICIPANTS);
    assert.equal(body.action, "1002003");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should include username, uids, and sysid in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteParticipants(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "user3");
    assert.equal(body.uids, '["uid1","uid2","uid3"]');
    assert.equal(body.sysid, 300);
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => deleteParticipants(input, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should pass uids (not users) in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteParticipants(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("uids" in body);
    assert.equal("users" in body, false);
  });
});

// ─── querySurveyBinding ─────────────────────────────────────────────

describe("querySurveyBinding", () => {
  const input = { username: "user4", vid: 12345, sysid: 400 };

  it("should use action 1002005 with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.QUERY_SURVEY_BINDING);
    assert.equal(body.action, "1002005");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should include username, vid, and sysid in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "user4");
    assert.equal(body.vid, 12345);
    assert.equal(body.sysid, 400);
  });

  it("should not include pagination fields (removed from API)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("page_index" in body, false);
    assert.equal("page_size" in body, false);
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

    const result = await querySurveyBinding(input, credentials, fetch);
    assert.equal(callCount, 3);
    assert.deepEqual(result, { result: true, data: { bindings: [] } });
  });
});

// ─── queryUserSurveys ───────────────────────────────────────────────

describe("queryUserSurveys", () => {
  const input = { username: "user5", uid: "uid-abc-123", sysid: 500 };

  it("should use action 1002006 with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryUserSurveys(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.QUERY_USER_SURVEYS);
    assert.equal(body.action, "1002006");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should include username, uid, and sysid in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryUserSurveys(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "user5");
    assert.equal(body.uid, "uid-abc-123");
    assert.equal(body.sysid, 500);
  });

  it("should not include pagination fields (removed from API)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryUserSurveys(input, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("page_index" in body, false);
    assert.equal("page_size" in body, false);
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

    const result = await queryUserSurveys(input, credentials, fetch);
    assert.equal(callCount, 3);
    assert.deepEqual(result, { result: true, data: { surveys: [] } });
  });

  it("should return parsed API error response", async () => {
    const mockResponse = { result: false, errormsg: "user not found" };
    const result = await queryUserSurveys(input, credentials, mockFetch(mockResponse));
    assert.deepEqual(result, mockResponse);
  });
});

// ─── constants ──────────────────────────────────────────────────────

describe("user-system constants", () => {
  it("getWjxUserSystemApiUrl() should be the usersystem endpoint", () => {
    assert.equal(getWjxUserSystemApiUrl(), "https://www.wjx.cn/openapi/usersystem.aspx");
  });

  it("should export all user-system action codes", () => {
    assert.equal(Action.ADD_PARTICIPANTS, "1002001");
    assert.equal(Action.MODIFY_PARTICIPANTS, "1002002");
    assert.equal(Action.DELETE_PARTICIPANTS, "1002003");
    assert.equal(Action.QUERY_SURVEY_BINDING, "1002005");
    assert.equal(Action.QUERY_USER_SURVEYS, "1002006");
  });
});
