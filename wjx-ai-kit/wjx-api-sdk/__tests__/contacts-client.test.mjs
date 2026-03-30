import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  queryContacts,
  addContacts,
  deleteContacts,
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

// ─── queryContacts ──────────────────────────────────────────────────

describe("queryContacts", () => {
  it("should POST with JSON content type and Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ corpid: "test-corp", uid: "user1" }, credentials, fetch);

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.headers["Authorization"], "Bearer test-token");
  });

  it("should use QUERY_CONTACTS action code (1005001)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ corpid: "test-corp", uid: "user1" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.QUERY_CONTACTS);
    assert.equal(body.action, "1005001");
  });

  it("should include corpid and uid in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ corpid: "my-corp", uid: "alice@example.com" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.uid, "alice@example.com");
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ corpid: "test-corp", uid: "user1" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
  });

  it("should use Bearer auth and not include sign/appid/ts", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ corpid: "test-corp", uid: "user1" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ corpid: "test-corp", uid: "user1" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ corpid: "test-corp", uid: "user1" }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="), "URL should contain traceid query param");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ corpid: "test-corp", uid: "user1" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false, "appKey should never be in request body");
    assert.equal("appkey" in body, false, "appkey should never be in request body");
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ corpid: "test-corp", uid: "user1" }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { contacts: [{ name: "Alice" }] } };
    const result = await queryContacts(
      { corpid: "test-corp", uid: "user1" },
      credentials,
      mockFetch(mockResponse),
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => queryContacts({ corpid: "test-corp", uid: "user1" }, credentials, mockFetch("err", 500)),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ corpid: "test-corp", uid: "user1" }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005001"), "URL should contain action=1005001");
  });

  it("should fall back to WJX_CORP_ID env when corpid not provided", async () => {
    const saved = process.env.WJX_CORP_ID;
    process.env.WJX_CORP_ID = "env-corp";
    try {
      const fetch = mockFetch({ result: true, data: {} });
      await queryContacts({ uid: "user1" }, credentials, fetch);

      const body = JSON.parse(fetch.captured().init.body);
      assert.equal(body.corpid, "env-corp");
    } finally {
      if (saved !== undefined) process.env.WJX_CORP_ID = saved;
      else delete process.env.WJX_CORP_ID;
    }
  });

  it("should throw when corpid not provided and WJX_CORP_ID not set", async () => {
    const saved = process.env.WJX_CORP_ID;
    delete process.env.WJX_CORP_ID;
    try {
      await assert.rejects(
        () => queryContacts({ uid: "user1" }, credentials, mockFetch({ result: true })),
        /corpid is required/,
      );
    } finally {
      if (saved !== undefined) process.env.WJX_CORP_ID = saved;
    }
  });
});

// ─── addContacts ────────────────────────────────────────────────────

describe("addContacts", () => {
  const usersJson = JSON.stringify([{ name: "Bob", mobile: "1234567890" }]);

  it("should POST with JSON content type and Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ corpid: "test-corp", users: usersJson }, credentials, fetch);

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.headers["Authorization"], "Bearer test-token");
  });

  it("should use ADD_CONTACTS action code (1005002)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ corpid: "test-corp", users: usersJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_CONTACTS);
    assert.equal(body.action, "1005002");
  });

  it("should include corpid and users in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ corpid: "my-corp", users: usersJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.users, usersJson);
  });

  it("should NOT include username or members in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ corpid: "test-corp", users: usersJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
    assert.equal("members" in body, false, "members should not appear in request body");
  });

  it("should use Bearer auth, no sign/appid/ts", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ corpid: "test-corp", users: usersJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ corpid: "test-corp", users: usersJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ corpid: "test-corp", users: usersJson }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="), "URL should contain traceid query param");
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ corpid: "test-corp", users: usersJson }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should include auto_create_udept as '1' when true", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts(
      { corpid: "test-corp", users: usersJson, auto_create_udept: true },
      credentials, fetch,
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.auto_create_udept, "1");
  });

  it("should include auto_create_udept as '0' when false", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts(
      { corpid: "test-corp", users: usersJson, auto_create_udept: false },
      credentials, fetch,
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.auto_create_udept, "0");
  });

  it("should include auto_create_tag as '1' when true", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts(
      { corpid: "test-corp", users: usersJson, auto_create_tag: true },
      credentials, fetch,
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.auto_create_tag, "1");
  });

  it("should include auto_create_tag as '0' when false", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts(
      { corpid: "test-corp", users: usersJson, auto_create_tag: false },
      credentials, fetch,
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.auto_create_tag, "0");
  });

  it("should not include auto_create_udept/auto_create_tag when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ corpid: "test-corp", users: usersJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("auto_create_udept" in body, false);
    assert.equal("auto_create_tag" in body, false);
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("Server Error"), {
        status: 500,
        statusText: "Internal Server Error",
      });
    };

    await assert.rejects(
      () => addContacts({ corpid: "test-corp", users: usersJson }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "addContacts should make exactly 1 request (no retries)");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { added: 1 } };
    const result = await addContacts(
      { corpid: "test-corp", users: usersJson },
      credentials,
      mockFetch(mockResponse),
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should return parsed API error response", async () => {
    const mockResponse = { result: false, errormsg: "invalid users" };
    const result = await addContacts(
      { corpid: "test-corp", users: usersJson },
      credentials,
      mockFetch(mockResponse),
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ corpid: "test-corp", users: usersJson }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005002"), "URL should contain action=1005002");
  });

  it("should fall back to WJX_CORP_ID env when corpid not provided", async () => {
    const saved = process.env.WJX_CORP_ID;
    process.env.WJX_CORP_ID = "env-corp";
    try {
      const fetch = mockFetch({ result: true, data: {} });
      await addContacts({ users: usersJson }, credentials, fetch);

      const body = JSON.parse(fetch.captured().init.body);
      assert.equal(body.corpid, "env-corp");
    } finally {
      if (saved !== undefined) process.env.WJX_CORP_ID = saved;
      else delete process.env.WJX_CORP_ID;
    }
  });
});

// ─── deleteContacts ────────────────────────────────────────────────

describe("deleteContacts", () => {
  const uidsJson = JSON.stringify([1, 2, 3]);

  it("should POST with JSON content type and Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteContacts({ corpid: "test-corp", uids: uidsJson }, credentials, fetch);

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.headers["Authorization"], "Bearer test-token");
  });

  it("should use MANAGE_CONTACTS action code (1005003)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteContacts({ corpid: "test-corp", uids: uidsJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.MANAGE_CONTACTS);
    assert.equal(body.action, "1005003");
  });

  it("should include corpid and uids in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteContacts({ corpid: "my-corp", uids: uidsJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.uids, uidsJson);
  });

  it("should NOT include username, operation, or members in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteContacts({ corpid: "test-corp", uids: uidsJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false);
    assert.equal("operation" in body, false);
    assert.equal("members" in body, false);
  });

  it("should use Bearer auth, no sign/appid/ts", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteContacts({ corpid: "test-corp", uids: uidsJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteContacts({ corpid: "test-corp", uids: uidsJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false);
  });

  it("should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteContacts({ corpid: "test-corp", uids: uidsJson }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="), "URL should contain traceid query param");
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteContacts({ corpid: "test-corp", uids: uidsJson }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"));
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("Server Error"), {
        status: 500,
        statusText: "Internal Server Error",
      });
    };

    await assert.rejects(
      () => deleteContacts({ corpid: "test-corp", uids: uidsJson }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { deleted: 3 } };
    const result = await deleteContacts(
      { corpid: "test-corp", uids: uidsJson },
      credentials,
      mockFetch(mockResponse),
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => deleteContacts({ corpid: "test-corp", uids: uidsJson }, credentials, mockFetch("err", 500)),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteContacts({ corpid: "test-corp", uids: uidsJson }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005003"));
  });

  it("should fall back to WJX_CORP_ID env when corpid not provided", async () => {
    const saved = process.env.WJX_CORP_ID;
    process.env.WJX_CORP_ID = "env-corp";
    try {
      const fetch = mockFetch({ result: true, data: {} });
      await deleteContacts({ uids: uidsJson }, credentials, fetch);

      const body = JSON.parse(fetch.captured().init.body);
      assert.equal(body.corpid, "env-corp");
    } finally {
      if (saved !== undefined) process.env.WJX_CORP_ID = saved;
      else delete process.env.WJX_CORP_ID;
    }
  });
});

// ─── queryContacts retry behavior (default maxRetries=2) ────────────

describe("queryContacts retry behavior", () => {
  it("should retry on 500 (default maxRetries=2)", async () => {
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

    const result = await queryContacts({ corpid: "test-corp", uid: "user1" }, credentials, fetch);
    assert.equal(callCount, 3, "should have retried twice before succeeding");
    assert.deepEqual(result, { result: true, data: {} });
  });

  it("should throw on 404 without retry", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response("Not Found", { status: 404, statusText: "Not Found" });
    };

    await assert.rejects(
      () => queryContacts({ corpid: "test-corp", uid: "user1" }, credentials, fetch),
      /WJX API request failed with 404/,
    );
    assert.equal(callCount, 1, "should not retry on 404");
  });
});
