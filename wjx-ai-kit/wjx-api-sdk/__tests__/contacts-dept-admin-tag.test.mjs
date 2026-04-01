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
  Action,
} from "../dist/index.js";

const credentials = { apiKey: "test-token" };

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

// ─── addAdmin ────────────────────────────────────────────────────────

describe("addAdmin", () => {
  it("should POST with JSON content type and Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch);

    const { init } = fetch.captured();
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.headers["Authorization"], "Bearer test-token");
  });

  it("should use ADD_ADMIN action code (1005004)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_ADMIN);
    assert.equal(body.action, "1005004");
  });

  it("should include corpid and users in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    const usersJson = '[{"admin_name":"Bob","mobile":"13800000000"}]';
    await addAdmin({ corpid: "my-corp", users: usersJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.users, usersJson);
  });

  it("should NOT include username in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("username" in body, false);
  });

  it("should use Bearer auth, no sign/appid/ts", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false);
  });

  it("should use contacts.aspx endpoint", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("contacts.aspx"));
  });

  it("should NOT retry on 500 (maxRetries=0 for write)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should return parsed API response", async () => {
    const mockResponse = { result: true, data: { admin_id: 42 } };
    const result = await addAdmin(
      { corpid: "test-corp", users: '[{"admin_name":"Alice"}]' },
      credentials, mockFetch(mockResponse),
    );
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, mockFetch("err", 500)),
      /WJX API request failed with 500/,
    );
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch);

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1005004"));
  });

  it("should fall back to WJX_CORP_ID env when corpid not provided", async () => {
    const saved = process.env.WJX_CORP_ID;
    process.env.WJX_CORP_ID = "env-corp";
    try {
      const fetch = mockFetch({ result: true, data: {} });
      await addAdmin({ users: '[{"admin_name":"Alice"}]' }, credentials, fetch);

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
  it("should use DELETE_ADMIN action code (1005005)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.DELETE_ADMIN);
    assert.equal(body.action, "1005005");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should include corpid and uids in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "my-corp", uids: "uid1,uid2,uid3" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.uids, "uid1,uid2,uid3");
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005005"));
  });
});

// ─── restoreAdmin ────────────────────────────────────────────────────

describe("restoreAdmin", () => {
  it("should use RESTORE_ADMIN action code (1005006)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.RESTORE_ADMIN);
    assert.equal(body.action, "1005006");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should include corpid and uids in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "my-corp", uids: "uid5,uid6" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.uids, "uid5,uid6");
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005006"));
  });
});

// ─── listDepartments ─────────────────────────────────────────────────

describe("listDepartments", () => {
  it("should use LIST_DEPARTMENTS action code (1005101) with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.LIST_DEPARTMENTS);
    assert.equal(body.action, "1005101");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should include corpid in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "my-corp" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
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

    const result = await listDepartments({ corpid: "test-corp" }, credentials, fetch);
    assert.equal(callCount, 3);
    assert.deepEqual(result, { result: true, data: {} });
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005101"));
  });
});

// ─── addDepartment ───────────────────────────────────────────────────

describe("addDepartment", () => {
  it("should use ADD_DEPARTMENT action code (1005102) with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_DEPARTMENT);
    assert.equal(body.action, "1005102");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should include corpid and depts in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    const deptsJson = '["研发部/后端", "产品部"]';
    await addDepartment({ corpid: "my-corp", depts: deptsJson }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.depts, deptsJson);
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005102"));
  });
});

// ─── modifyDepartment ────────────────────────────────────────────────

describe("modifyDepartment", () => {
  it("should use MODIFY_DEPARTMENT action code (1005103) with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ corpid: "test-corp", depts: '[{"id":"d1","name":"新"}]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.MODIFY_DEPARTMENT);
    assert.equal(body.action, "1005103");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => modifyDepartment({ corpid: "test-corp", depts: '[{"id":"d1","name":"X"}]' }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ corpid: "test-corp", depts: '[{"id":"d1","name":"X"}]' }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005103"));
  });
});

// ─── deleteDepartment ────────────────────────────────────────────────

describe("deleteDepartment", () => {
  it("should use DELETE_DEPARTMENT action code (1005104) with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.DELETE_DEPARTMENT);
    assert.equal(body.action, "1005104");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should include corpid, type, and depts in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "my-corp", type: "2", depts: '["研发部"]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.type, "2");
    assert.equal(body.depts, '["研发部"]');
  });

  it("should include optional del_child when provided (converted to string)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment(
      { corpid: "test-corp", type: "1", depts: '["d1"]', del_child: true },
      credentials, fetch,
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.del_child, "1");
  });

  it("should convert del_child=false to '0'", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment(
      { corpid: "test-corp", type: "1", depts: '["d1"]', del_child: false },
      credentials, fetch,
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.del_child, "0");
  });

  it("should not include del_child when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("del_child" in body, false);
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005104"));
  });
});

// ─── listTags ────────────────────────────────────────────────────────

describe("listTags", () => {
  it("should use LIST_TAGS action code (1005201) with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "test-corp" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.LIST_TAGS);
    assert.equal(body.action, "1005201");
    assertBearerAuth(fetch.captured().init, body);
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

    const result = await listTags({ corpid: "test-corp" }, credentials, fetch);
    assert.equal(callCount, 3);
    assert.deepEqual(result, { result: true, data: {} });
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "test-corp" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005201"));
  });
});

// ─── addTag ──────────────────────────────────────────────────────────

describe("addTag", () => {
  it("should use ADD_TAG action code (1005202) with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.ADD_TAG);
    assert.equal(body.action, "1005202");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should pass is_radio as '1' when true", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]', is_radio: true }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.is_radio, "1");
  });

  it("should pass is_radio as '0' when false", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]', is_radio: false }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.is_radio, "0");
  });

  it("should not include is_radio when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("is_radio" in body, false);
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005202"));
  });
});

// ─── modifyTag ───────────────────────────────────────────────────────

describe("modifyTag", () => {
  it("should use MODIFY_TAG action code (1005203) with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.MODIFY_TAG);
    assert.equal(body.action, "1005203");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should include optional tp_name when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1", tp_name: "新标签组名" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.tp_name, "新标签组名");
  });

  it("should include optional child_names when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    const childNames = '[{"id":"c1","name":"新名称"}]';
    await modifyTag({ corpid: "test-corp", tp_id: "tp1", child_names: childNames }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.child_names, childNames);
  });

  it("should not include optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("tp_name" in body, false);
    assert.equal("child_names" in body, false);
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005203"));
  });
});

// ─── deleteTag ───────────────────────────────────────────────────────

describe("deleteTag", () => {
  it("should use DELETE_TAG action code (1005204) with Bearer auth", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.DELETE_TAG);
    assert.equal(body.action, "1005204");
    assertBearerAuth(fetch.captured().init, body);
  });

  it("should include corpid, type, and tags in request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "my-corp", type: "2", tags: '["学历"]' }, credentials, fetch);

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.corpid, "my-corp");
    assert.equal(body.type, "2");
    assert.equal(body.tags, '["学历"]');
  });

  it("should NOT retry on 500", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });

  it("should include action in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005204"));
  });
});

// ─── URL action parameter ───────────────────────────────────────────

describe("URL action parameter (contacts admin/dept/tag)", () => {
  it("addAdmin URL should include action=1005004", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addAdmin({ corpid: "test-corp", users: '[{"admin_name":"Alice"}]' }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005004"));
  });

  it("deleteAdmin URL should include action=1005005", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005005"));
  });

  it("restoreAdmin URL should include action=1005006", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await restoreAdmin({ corpid: "test-corp", uids: "uid1" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005006"));
  });

  it("listDepartments URL should include action=1005101", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listDepartments({ corpid: "test-corp" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005101"));
  });

  it("addDepartment URL should include action=1005102", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addDepartment({ corpid: "test-corp", depts: '["研发部"]' }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005102"));
  });

  it("modifyDepartment URL should include action=1005103", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyDepartment({ corpid: "test-corp", depts: '[{"id":"d1","name":"X"}]' }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005103"));
  });

  it("deleteDepartment URL should include action=1005104", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteDepartment({ corpid: "test-corp", type: "1", depts: '["d1"]' }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005104"));
  });

  it("listTags URL should include action=1005201", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listTags({ corpid: "test-corp" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005201"));
  });

  it("addTag URL should include action=1005202", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await addTag({ corpid: "test-corp", child_names: '["学历/本科"]' }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005202"));
  });

  it("modifyTag URL should include action=1005203", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await modifyTag({ corpid: "test-corp", tp_id: "tp1" }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005203"));
  });

  it("deleteTag URL should include action=1005204", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await deleteTag({ corpid: "test-corp", type: "1", tags: '["t1"]' }, credentials, fetch);
    assert.ok(fetch.captured().url.includes("action=1005204"));
  });
});
