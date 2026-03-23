import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addAdmin,
  deleteAdmin,
  restoreAdmin,
  listDepartments,
  addDepartment,
  modifyDepartment,
  deleteDepartment,
  listTags,
  addTag,
  modifyTag,
  deleteTag,
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

// ─── addAdmin ────────────────────────────────────────────────────────

describe("addAdmin", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use ADD_ADMIN action code (1005004)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_ADMIN);
    assert.equal(body.action, "1005004");
  });

  it("should include corpid and users in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    const usersJson = '[{"admin_name":"Bob","mobile":"13800000000"}]';
    await addAdmin({ corpid: "my-corp", users: usersJson }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.users, usersJson);
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { admin_id: 42 } };
    const result = await addAdmin(
      { corpid: "test-corp", users: '[{"admin_name":"Alice"}]' },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005004"));
  });

  it("should fall back to WJX_CORP_ID env when corpid not provided", async () => {
    const saved = process.env.WJX_CORP_ID;
    process.env.WJX_CORP_ID = "env-corp";
    try {
      const fetch = mockFetch({ result: true, data: {} });
      await addAdmin({ users: '[{"admin_name":"Alice"}]' }, credentials, fetch, "100");

      const body = JSON.parse(fetch.captured().init.body);
      assert.equal(body.corpid, "env-corp");
    } finally {
      if (saved !== undefined) process.env.WJX_CORP_ID = saved;
      else delete process.env.WJX_CORP_ID;
    }
  });
});

// ─── deleteAdmin ─────────────────────────────────────────────────────

describe("deleteAdmin", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "test-corp", uids: "uid1,uid2" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use DELETE_ADMIN action code (1005005)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.DELETE_ADMIN);
    assert.equal(body.action, "1005005");
  });

  it("should include corpid and uids in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "my-corp", uids: "uid1,uid2,uid3" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.uids, "uid1,uid2,uid3");
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await deleteAdmin(
      { corpid: "test-corp", uids: "uid1" },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005005"));
  });

  it("should fall back to WJX_CORP_ID env when corpid not provided", async () => {
    const saved = process.env.WJX_CORP_ID;
    process.env.WJX_CORP_ID = "env-corp";
    try {
      const fetch = mockFetch({ result: true, data: {} });
      await deleteAdmin({ uids: "uid1" }, credentials, fetch, "100");

      const body = JSON.parse(fetch.captured().init.body);
      assert.equal(body.corpid, "env-corp");
    } finally {
      if (saved !== undefined) process.env.WJX_CORP_ID = saved;
      else delete process.env.WJX_CORP_ID;
    }
  });
});

// ─── restoreAdmin ────────────────────────────────────────────────────

describe("restoreAdmin", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use RESTORE_ADMIN action code (1005006)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.RESTORE_ADMIN);
    assert.equal(body.action, "1005006");
  });

  it("should include corpid and uids in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "my-corp", uids: "uid5,uid6" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.uids, "uid5,uid6");
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await restoreAdmin(
      { corpid: "test-corp", uids: "uid1" },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005006"));
  });

  it("should fall back to WJX_CORP_ID env when corpid not provided", async () => {
    const saved = process.env.WJX_CORP_ID;
    process.env.WJX_CORP_ID = "env-corp";
    try {
      const fetch = mockFetch({ result: true, data: {} });
      await restoreAdmin({ uids: "uid1" }, credentials, fetch, "100");

      const body = JSON.parse(fetch.captured().init.body);
      assert.equal(body.corpid, "env-corp");
    } finally {
      if (saved !== undefined) process.env.WJX_CORP_ID = saved;
      else delete process.env.WJX_CORP_ID;
    }
  });
});

// ─── listDepartments ─────────────────────────────────────────────────

describe("listDepartments", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use LIST_DEPARTMENTS action code (1005101)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.LIST_DEPARTMENTS);
    assert.equal(body.action, "1005101");
  });

  it("should include corpid in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "my-corp" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
  });

  it("should pass optional page_index and page_size when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments(
      { corpid: "test-corp", page_index: 2, page_size: 20 },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.page_index, 2);
    assert.equal(body.page_size, 20);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("page_index" in body, false);
    assert.equal("page_size" in body, false);
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should retry on 500 (default maxRetries=2 for read)", async () => {
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

    const result = await listDepartments({ corpid: "test-corp" }, credentials, fetch, "100");
    assert.equal(callCount, 3);
    assert.deepEqual(result, { result: true, data: {} });
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { departments: [] } };
    const result = await listDepartments(
      { corpid: "test-corp" },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005101"));
  });
});

// ─── addDepartment ───────────────────────────────────────────────────

describe("addDepartment", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ corpid: "test-corp", depts: '["研发部/后端"]' }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use ADD_DEPARTMENT action code (1005102)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_DEPARTMENT);
    assert.equal(body.action, "1005102");
  });

  it("should include corpid and depts in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    const deptsJson = '["研发部/后端", "产品部"]';
    await addDepartment({ corpid: "my-corp", depts: deptsJson }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.depts, deptsJson);
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await addDepartment(
      { corpid: "test-corp", depts: '["研发部"]' },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005102"));
  });
});

// ─── modifyDepartment ────────────────────────────────────────────────

describe("modifyDepartment", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    const deptsJson = '[{"id":"d1","name":"新部门名"}]';
    await modifyDepartment({ corpid: "test-corp", depts: deptsJson }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use MODIFY_DEPARTMENT action code (1005103)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    const deptsJson = '[{"id":"d1","name":"新部门名"}]';
    await modifyDepartment({ corpid: "test-corp", depts: deptsJson }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.MODIFY_DEPARTMENT);
    assert.equal(body.action, "1005103");
  });

  it("should include corpid and depts in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    const deptsJson = '[{"id":"d1","name":"Updated"}]';
    await modifyDepartment({ corpid: "my-corp", depts: deptsJson }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.depts, deptsJson);
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ corpid: "test-corp", depts: '[{"id":"d1","name":"X"}]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ corpid: "test-corp", depts: '[{"id":"d1","name":"X"}]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ corpid: "test-corp", depts: '[{"id":"d1","name":"X"}]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ corpid: "test-corp", depts: '[{"id":"d1","name":"X"}]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ corpid: "test-corp", depts: '[{"id":"d1","name":"X"}]' }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => modifyDepartment({ corpid: "test-corp", depts: '[{"id":"d1","name":"X"}]' }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await modifyDepartment(
      { corpid: "test-corp", depts: '[{"id":"d1","name":"X"}]' },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ corpid: "test-corp", depts: '[{"id":"d1","name":"X"}]' }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005103"));
  });
});

// ─── deleteDepartment ────────────────────────────────────────────────

describe("deleteDepartment", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use DELETE_DEPARTMENT action code (1005104)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.DELETE_DEPARTMENT);
    assert.equal(body.action, "1005104");
  });

  it("should include corpid, type, and depts in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "my-corp", type: "2", depts: '["研发部"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.type, "2");
    assert.equal(body.depts, '["研发部"]');
  });

  it("should include optional del_child when provided (converted to string)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment(
      { corpid: "test-corp", type: "1", depts: '["d1"]', del_child: true },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.del_child, "1");
  });

  it("should convert del_child=false to '0'", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment(
      { corpid: "test-corp", type: "1", depts: '["d1"]', del_child: false },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.del_child, "0");
  });

  it("should not include del_child when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("del_child" in body, false);
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await deleteDepartment(
      { corpid: "test-corp", type: "1", depts: '["d1"]' },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005104"));
  });
});

// ─── listTags ────────────────────────────────────────────────────────

describe("listTags", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "test-corp" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use LIST_TAGS action code (1005201)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "test-corp" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.LIST_TAGS);
    assert.equal(body.action, "1005201");
  });

  it("should include corpid in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "my-corp" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "test-corp" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "test-corp" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "test-corp" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "test-corp" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "test-corp" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should retry on 500 (default maxRetries=2 for read)", async () => {
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

    const result = await listTags({ corpid: "test-corp" }, credentials, fetch, "100");
    assert.equal(callCount, 3);
    assert.deepEqual(result, { result: true, data: {} });
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { tags: [] } };
    const result = await listTags(
      { corpid: "test-corp" },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "test-corp" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005201"));
  });
});

// ─── addTag ──────────────────────────────────────────────────────────

describe("addTag", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use ADD_TAG action code (1005202)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_TAG);
    assert.equal(body.action, "1005202");
  });

  it("should include corpid and child_names in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    const tagsJson = '["学历/本科", "学历/硕士"]';
    await addTag({ corpid: "my-corp", child_names: tagsJson }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.child_names, tagsJson);
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await addTag(
      { corpid: "test-corp", child_names: '["学历/本科"]' },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005202"));
  });
});

// ─── modifyTag ───────────────────────────────────────────────────────

describe("modifyTag", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use MODIFY_TAG action code (1005203)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.MODIFY_TAG);
    assert.equal(body.action, "1005203");
  });

  it("should include corpid and tp_id in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "my-corp", tp_id: "tp42" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.tp_id, "tp42");
  });

  it("should include optional tp_name when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1", tp_name: "新标签组名" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.tp_name, "新标签组名");
  });

  it("should include optional child_names when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    const childNames = '[{"id":"c1","name":"新名称"}]';
    await modifyTag({ corpid: "test-corp", tp_id: "tp1", child_names: childNames }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.child_names, childNames);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("tp_name" in body, false);
    assert.equal("child_names" in body, false);
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await modifyTag(
      { corpid: "test-corp", tp_id: "tp1", tp_name: "新名" },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005203"));
  });
});

// ─── deleteTag ───────────────────────────────────────────────────────

describe("deleteTag", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use DELETE_TAG action code (1005204)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.DELETE_TAG);
    assert.equal(body.action, "1005204");
  });

  it("should include corpid, type, and tags in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "my-corp", type: "2", tags: '["学历"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.type, "2");
    assert.equal(body.tags, '["学历"]');
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false, "username should not appear in request body");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"), "URL should use contacts.aspx endpoint");
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await deleteTag(
      { corpid: "test-corp", type: "1", tags: '["t1"]' },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005204"));
  });
});

// ─── URL action parameter ───────────────────────────────────────────

describe("URL action parameter (contacts admin/dept/tag)", () => {
  it("addAdmin URL should include action=1005004", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch, "100");
    assert.ok(fetch.captured().url.includes("action=1005004"));
  });

  it("deleteAdmin URL should include action=1005005", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");
    assert.ok(fetch.captured().url.includes("action=1005005"));
  });

  it("restoreAdmin URL should include action=1005006", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch, "100");
    assert.ok(fetch.captured().url.includes("action=1005006"));
  });

  it("listDepartments URL should include action=1005101", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch, "100");
    assert.ok(fetch.captured().url.includes("action=1005101"));
  });

  it("addDepartment URL should include action=1005102", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch, "100");
    assert.ok(fetch.captured().url.includes("action=1005102"));
  });

  it("modifyDepartment URL should include action=1005103", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ corpid: "test-corp", depts: '[{"id":"d1","name":"X"}]' }, credentials, fetch, "100");
    assert.ok(fetch.captured().url.includes("action=1005103"));
  });

  it("deleteDepartment URL should include action=1005104", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch, "100");
    assert.ok(fetch.captured().url.includes("action=1005104"));
  });

  it("listTags URL should include action=1005201", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "test-corp" }, credentials, fetch, "100");
    assert.ok(fetch.captured().url.includes("action=1005201"));
  });

  it("addTag URL should include action=1005202", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch, "100");
    assert.ok(fetch.captured().url.includes("action=1005202"));
  });

  it("modifyTag URL should include action=1005203", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch, "100");
    assert.ok(fetch.captured().url.includes("action=1005203"));
  });

  it("deleteTag URL should include action=1005204", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch, "100");
    assert.ok(fetch.captured().url.includes("action=1005204"));
  });
});
