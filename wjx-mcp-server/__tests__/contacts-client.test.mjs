import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  queryContacts,
  addContacts,
  manageContacts,
} from "../dist/modules/contacts/client.js";
import { Action } from "../dist/core/constants.js";

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

// ─── queryContacts ──────────────────────────────────────────────────

describe("queryContacts", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ username: "user1" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use QUERY_CONTACTS action code (1005001)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ username: "user1" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.QUERY_CONTACTS);
    assert.equal(body.action, "1005001");
  });

  it("should include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ username: "alice@example.com" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "alice@example.com");
  });

  it("should include appid and ts in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ username: "user1" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.appid, "test-app");
    assert.equal(body.ts, "1700000000");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ username: "user1" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body, "body should have sign field");
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ username: "user1" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ username: "user1" }, credentials, fetch, "1700000000");

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="), "URL should contain traceid query param");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ username: "user1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false, "appKey should never be in request body");
    assert.equal("appkey" in body, false, "appkey should never be in request body");
  });

  it("should pass optional dept_id when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ username: "user1", dept_id: 42 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.dept_id, 42);
  });

  it("should pass optional page_index and page_size when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts(
      { username: "user1", page_index: 2, page_size: 20 },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.page_index, 2);
    assert.equal(body.page_size, 20);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ username: "user1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("dept_id" in body, false);
    assert.equal("page_index" in body, false);
    assert.equal("page_size" in body, false);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { contacts: [{ name: "Alice" }] } };
    const result = await queryContacts(
      { username: "user1" },
      credentials,
      mockFetch(mockResponse),
      "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => queryContacts({ username: "user1" }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await queryContacts({ username: "user1" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005001"), "URL should contain action=1005001");
  });
});

// ─── addContacts ────────────────────────────────────────────────────

describe("addContacts", () => {
  const membersJson = JSON.stringify([{ name: "Bob", mobile: "1234567890" }]);

  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ username: "user1", members: membersJson }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use ADD_CONTACTS action code (1005002)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ username: "user1", members: membersJson }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_CONTACTS);
    assert.equal(body.action, "1005002");
  });

  it("should include username and members in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ username: "admin", members: membersJson }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "admin");
    assert.equal(body.members, membersJson);
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ username: "user1", members: membersJson }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ username: "user1", members: membersJson }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ username: "user1", members: membersJson }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
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
      () => addContacts({ username: "user1", members: membersJson }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "addContacts should make exactly 1 request (no retries)");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { added: 1 } };
    const result = await addContacts(
      { username: "user1", members: membersJson },
      credentials,
      mockFetch(mockResponse),
      "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should return parsed API error response", async () => {
    const mockResponse = { result: false, errormsg: "invalid members" };
    const result = await addContacts(
      { username: "user1", members: membersJson },
      credentials,
      mockFetch(mockResponse),
      "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addContacts({ username: "user1", members: membersJson }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005002"), "URL should contain action=1005002");
  });
});

// ─── manageContacts ─────────────────────────────────────────────────

describe("manageContacts", () => {
  const updateMembers = JSON.stringify([{ id: 1, name: "Updated Bob" }]);
  const deleteMembers = JSON.stringify([1, 2, 3]);

  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await manageContacts(
      { username: "user1", operation: "update", members: updateMembers },
      credentials,
      fetch,
      "1700000000",
    );

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use MANAGE_CONTACTS action code (1005003)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await manageContacts(
      { username: "user1", operation: "update", members: updateMembers },
      credentials,
      fetch,
      "1700000000",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.MANAGE_CONTACTS);
    assert.equal(body.action, "1005003");
  });

  it("should include username, operation, and members in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await manageContacts(
      { username: "admin", operation: "update", members: updateMembers },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "admin");
    assert.equal(body.operation, "update");
    assert.equal(body.members, updateMembers);
  });

  it("should support delete operation", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await manageContacts(
      { username: "user1", operation: "delete", members: deleteMembers },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.operation, "delete");
    assert.equal(body.members, deleteMembers);
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await manageContacts(
      { username: "user1", operation: "update", members: updateMembers },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await manageContacts(
      { username: "user1", operation: "update", members: updateMembers },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await manageContacts(
      { username: "user1", operation: "delete", members: deleteMembers },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
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
      () =>
        manageContacts(
          { username: "user1", operation: "update", members: updateMembers },
          credentials,
          fetch,
          "100",
        ),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "manageContacts should make exactly 1 request (no retries)");
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { updated: 1 } };
    const result = await manageContacts(
      { username: "user1", operation: "update", members: updateMembers },
      credentials,
      mockFetch(mockResponse),
      "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () =>
        manageContacts(
          { username: "user1", operation: "delete", members: deleteMembers },
          credentials,
          mockFetch("err", 500),
          "100",
        ),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await manageContacts(
      { username: "user1", operation: "update", members: updateMembers },
      credentials,
      fetch,
      "100",
    );

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005003"), "URL should contain action=1005003");
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

    const result = await queryContacts({ username: "user1" }, credentials, fetch, "100");
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
      () => queryContacts({ username: "user1" }, credentials, fetch, "100"),
      /WJX API request failed with 404/,
    );
    assert.equal(callCount, 1, "should not retry on 404");
  });
});

// ─── sign consistency ───────────────────────────────────────────────

describe("sign consistency", () => {
  it("queryContacts should produce different signs for different timestamps", async () => {
    const fetch1 = mockFetch({ result: true, data: {} });
    const fetch2 = mockFetch({ result: true, data: {} });

    await queryContacts({ username: "user1" }, credentials, fetch1, "100");
    await queryContacts({ username: "user1" }, credentials, fetch2, "200");

    const body1 = JSON.parse(fetch1.captured().init.body);
    const body2 = JSON.parse(fetch2.captured().init.body);
    assert.notEqual(body1.sign, body2.sign);
  });

  it("addContacts should produce different signs for different appKeys", async () => {
    const cred1 = { appId: "app", appKey: "key1" };
    const cred2 = { appId: "app", appKey: "key2" };
    const members = JSON.stringify([{ name: "Test" }]);
    const fetch1 = mockFetch({ result: true, data: {} });
    const fetch2 = mockFetch({ result: true, data: {} });

    await addContacts({ username: "user1", members }, cred1, fetch1, "100");
    await addContacts({ username: "user1", members }, cred2, fetch2, "100");

    const body1 = JSON.parse(fetch1.captured().init.body);
    const body2 = JSON.parse(fetch2.captured().init.body);
    assert.notEqual(body1.sign, body2.sign);
  });
});
