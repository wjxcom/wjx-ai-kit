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
    await addAdmin({ username: "user1", admin_name: "Alice" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use ADD_ADMIN action code (1005004)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ username: "user1", admin_name: "Alice" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_ADMIN);
    assert.equal(body.action, "1005004");
  });

  it("should include username and admin_name in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ username: "admin", admin_name: "Bob" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "admin");
    assert.equal(body.admin_name, "Bob");
  });

  it("should include optional fields when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin(
      { username: "user1", admin_name: "Alice", mobile: "13800000000", email: "a@b.com", role: "editor" },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.mobile, "13800000000");
    assert.equal(body.email, "a@b.com");
    assert.equal(body.role, "editor");
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ username: "user1", admin_name: "Alice" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("mobile" in body, false);
    assert.equal("email" in body, false);
    assert.equal("role" in body, false);
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ username: "user1", admin_name: "Alice" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => addAdmin({ username: "user1", admin_name: "Alice" }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { admin_id: 42 } };
    const result = await addAdmin(
      { username: "user1", admin_name: "Alice" },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ username: "user1", admin_name: "Alice" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005004"));
  });
});

// ─── deleteAdmin ─────────────────────────────────────────────────────

describe("deleteAdmin", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ username: "user1", admin_id: 1 }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use DELETE_ADMIN action code (1005005)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ username: "user1", admin_id: 1 }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.DELETE_ADMIN);
    assert.equal(body.action, "1005005");
  });

  it("should include username and admin_id in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ username: "admin", admin_id: 99 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "admin");
    assert.equal(body.admin_id, 99);
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ username: "user1", admin_id: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => deleteAdmin({ username: "user1", admin_id: 1 }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await deleteAdmin(
      { username: "user1", admin_id: 1 },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => deleteAdmin({ username: "user1", admin_id: 1 }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ username: "user1", admin_id: 1 }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005005"));
  });
});

// ─── restoreAdmin ────────────────────────────────────────────────────

describe("restoreAdmin", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ username: "user1", admin_id: 1 }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use RESTORE_ADMIN action code (1005006)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ username: "user1", admin_id: 1 }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.RESTORE_ADMIN);
    assert.equal(body.action, "1005006");
  });

  it("should include username and admin_id in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ username: "admin", admin_id: 5 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "admin");
    assert.equal(body.admin_id, 5);
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ username: "user1", admin_id: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => restoreAdmin({ username: "user1", admin_id: 1 }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await restoreAdmin(
      { username: "user1", admin_id: 1 },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ username: "user1", admin_id: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ username: "user1", admin_id: 1 }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005006"));
  });
});

// ─── listDepartments ─────────────────────────────────────────────────

describe("listDepartments", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ username: "user1" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use LIST_DEPARTMENTS action code (1005101)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ username: "user1" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.LIST_DEPARTMENTS);
    assert.equal(body.action, "1005101");
  });

  it("should include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ username: "alice@example.com" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "alice@example.com");
  });

  it("should pass optional page_index and page_size when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments(
      { username: "user1", page_index: 2, page_size: 20 },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.page_index, 2);
    assert.equal(body.page_size, 20);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ username: "user1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("page_index" in body, false);
    assert.equal("page_size" in body, false);
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ username: "user1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
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

    const result = await listDepartments({ username: "user1" }, credentials, fetch, "100");
    assert.equal(callCount, 3);
    assert.deepEqual(result, { result: true, data: {} });
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { departments: [] } };
    const result = await listDepartments(
      { username: "user1" },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ username: "user1" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005101"));
  });
});

// ─── addDepartment ───────────────────────────────────────────────────

describe("addDepartment", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ username: "user1", name: "Engineering" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use ADD_DEPARTMENT action code (1005102)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ username: "user1", name: "Engineering" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_DEPARTMENT);
    assert.equal(body.action, "1005102");
  });

  it("should include username and name in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ username: "admin", name: "Sales" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "admin");
    assert.equal(body.name, "Sales");
  });

  it("should include optional parent_id when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ username: "user1", name: "Sub", parent_id: 10 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.parent_id, 10);
  });

  it("should not include parent_id when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ username: "user1", name: "Top" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("parent_id" in body, false);
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ username: "user1", name: "Dept" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => addDepartment({ username: "user1", name: "Dept" }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { dept_id: 7 } };
    const result = await addDepartment(
      { username: "user1", name: "Dept" },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });
});

// ─── modifyDepartment ────────────────────────────────────────────────

describe("modifyDepartment", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ username: "user1", dept_id: 1 }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use MODIFY_DEPARTMENT action code (1005103)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ username: "user1", dept_id: 1 }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.MODIFY_DEPARTMENT);
    assert.equal(body.action, "1005103");
  });

  it("should include username and dept_id in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ username: "admin", dept_id: 5 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "admin");
    assert.equal(body.dept_id, 5);
  });

  it("should include optional name and parent_id when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment(
      { username: "user1", dept_id: 1, name: "New Name", parent_id: 2 },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.name, "New Name");
    assert.equal(body.parent_id, 2);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ username: "user1", dept_id: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("name" in body, false);
    assert.equal("parent_id" in body, false);
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ username: "user1", dept_id: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => modifyDepartment({ username: "user1", dept_id: 1 }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await modifyDepartment(
      { username: "user1", dept_id: 1, name: "X" },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });
});

// ─── deleteDepartment ────────────────────────────────────────────────

describe("deleteDepartment", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ username: "user1", dept_id: 1 }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use DELETE_DEPARTMENT action code (1005104)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ username: "user1", dept_id: 1 }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.DELETE_DEPARTMENT);
    assert.equal(body.action, "1005104");
  });

  it("should include username and dept_id in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ username: "admin", dept_id: 42 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "admin");
    assert.equal(body.dept_id, 42);
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ username: "user1", dept_id: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => deleteDepartment({ username: "user1", dept_id: 1 }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await deleteDepartment(
      { username: "user1", dept_id: 1 },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => deleteDepartment({ username: "user1", dept_id: 1 }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ username: "user1", dept_id: 1 }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005104"));
  });
});

// ─── listTags ────────────────────────────────────────────────────────

describe("listTags", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ username: "user1" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use LIST_TAGS action code (1005201)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ username: "user1" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.LIST_TAGS);
    assert.equal(body.action, "1005201");
  });

  it("should include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ username: "alice@example.com" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "alice@example.com");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ username: "user1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
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

    const result = await listTags({ username: "user1" }, credentials, fetch, "100");
    assert.equal(callCount, 3);
    assert.deepEqual(result, { result: true, data: {} });
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { tags: [{ id: 1, name: "VIP" }] } };
    const result = await listTags(
      { username: "user1" },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ username: "user1" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ username: "user1" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005201"));
  });
});

// ─── addTag ──────────────────────────────────────────────────────────

describe("addTag", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ username: "user1", tag_name: "VIP" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use ADD_TAG action code (1005202)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ username: "user1", tag_name: "VIP" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_TAG);
    assert.equal(body.action, "1005202");
  });

  it("should include username and tag_name in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ username: "admin", tag_name: "Important" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "admin");
    assert.equal(body.tag_name, "Important");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ username: "user1", tag_name: "VIP" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => addTag({ username: "user1", tag_name: "VIP" }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { tag_id: 3 } };
    const result = await addTag(
      { username: "user1", tag_name: "VIP" },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should NOT include appKey in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ username: "user1", tag_name: "VIP" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false);
    assert.equal("appkey" in body, false);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ username: "user1", tag_name: "VIP" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005202"));
  });
});

// ─── modifyTag ───────────────────────────────────────────────────────

describe("modifyTag", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ username: "user1", tag_id: 1, tag_name: "Updated" }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use MODIFY_TAG action code (1005203)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ username: "user1", tag_id: 1, tag_name: "Updated" }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.MODIFY_TAG);
    assert.equal(body.action, "1005203");
  });

  it("should include username, tag_id, and tag_name in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ username: "admin", tag_id: 5, tag_name: "Renamed" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "admin");
    assert.equal(body.tag_id, 5);
    assert.equal(body.tag_name, "Renamed");
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ username: "user1", tag_id: 1, tag_name: "X" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => modifyTag({ username: "user1", tag_id: 1, tag_name: "X" }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await modifyTag(
      { username: "user1", tag_id: 1, tag_name: "X" },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => modifyTag({ username: "user1", tag_id: 1, tag_name: "X" }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ username: "user1", tag_id: 1, tag_name: "X" }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005203"));
  });
});

// ─── deleteTag ───────────────────────────────────────────────────────

describe("deleteTag", () => {
  it("should POST with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ username: "user1", tag_id: 1 }, credentials, fetch, "1700000000");

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should use DELETE_TAG action code (1005204)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ username: "user1", tag_id: 1 }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.DELETE_TAG);
    assert.equal(body.action, "1005204");
  });

  it("should include username and tag_id in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ username: "admin", tag_id: 99 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.username, "admin");
    assert.equal(body.tag_id, 99);
  });

  it("should include sign as 40-char hex SHA1", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ username: "user1", tag_id: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => deleteTag({ username: "user1", tag_id: 1 }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: {} };
    const result = await deleteTag(
      { username: "user1", tag_id: 1 },
      credentials, mockFetch(mockResponse), "100",
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => deleteTag({ username: "user1", tag_id: 1 }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ username: "user1", tag_id: 1 }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005204"));
  });
});

// ─── sign consistency (new functions) ────────────────────────────────

describe("sign consistency (dept/admin/tag)", () => {
  it("addAdmin should produce different signs for different timestamps", async () => {
    const fetch1 = mockFetch({ result: true, data: {} });
    const fetch2 = mockFetch({ result: true, data: {} });

    await addAdmin({ username: "user1", admin_name: "A" }, credentials, fetch1, "100");
    await addAdmin({ username: "user1", admin_name: "A" }, credentials, fetch2, "200");

    const body1 = JSON.parse(fetch1.captured().init.body);
    const body2 = JSON.parse(fetch2.captured().init.body);
    assert.notEqual(body1.sign, body2.sign);
  });

  it("listDepartments should produce different signs for different appKeys", async () => {
    const cred1 = { appId: "app", appKey: "key1" };
    const cred2 = { appId: "app", appKey: "key2" };
    const fetch1 = mockFetch({ result: true, data: {} });
    const fetch2 = mockFetch({ result: true, data: {} });

    await listDepartments({ username: "user1" }, cred1, fetch1, "100");
    await listDepartments({ username: "user1" }, cred2, fetch2, "100");

    const body1 = JSON.parse(fetch1.captured().init.body);
    const body2 = JSON.parse(fetch2.captured().init.body);
    assert.notEqual(body1.sign, body2.sign);
  });

  it("addTag should produce different signs for different appKeys", async () => {
    const cred1 = { appId: "app", appKey: "key1" };
    const cred2 = { appId: "app", appKey: "key2" };
    const fetch1 = mockFetch({ result: true, data: {} });
    const fetch2 = mockFetch({ result: true, data: {} });

    await addTag({ username: "user1", tag_name: "T" }, cred1, fetch1, "100");
    await addTag({ username: "user1", tag_name: "T" }, cred2, fetch2, "100");

    const body1 = JSON.parse(fetch1.captured().init.body);
    const body2 = JSON.parse(fetch2.captured().init.body);
    assert.notEqual(body1.sign, body2.sign);
  });
});
