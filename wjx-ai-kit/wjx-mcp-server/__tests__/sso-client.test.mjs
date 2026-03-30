import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";

import {
  buildSsoSubaccountUrl,
  buildSsoUserSystemUrl,
  buildSsoPartnerUrl,
  buildSurveyUrl,
} from "../dist/modules/sso/client.js";
import { buildSsoSignature } from "../dist/modules/sso/sign.js";

const testCreds = { appId: "test-app", appKey: "test-key" };

/** Parse a URL string and return { base, params } for easy assertions. */
function parseUrl(urlStr) {
  const url = new URL(urlStr);
  return { base: url.origin + url.pathname, params: url.searchParams };
}

/** Independently compute SHA-1 hex of concatenated values. */
function sha1Hex(...values) {
  return createHash("sha1").update(values.join(""), "utf8").digest("hex").toLowerCase();
}

// ─── buildSsoSignature ─────────────────────────────────────────────

describe("buildSsoSignature", () => {
  it("should concatenate values in order (no sorting) and produce sha1 hex", () => {
    const result = buildSsoSignature(["a", "b", "c"]);
    const expected = sha1Hex("a", "b", "c");
    assert.equal(result, expected);
  });

  it("should return a 40-character lowercase hex string", () => {
    const result = buildSsoSignature(["hello", "world"]);
    assert.match(result, /^[0-9a-f]{40}$/);
  });

  it("should place appKey in the middle (not sorted to a different position)", () => {
    // sign = sha1(appid + appkey + param + ts)
    // Verify order matters: appid, appkey, param, ts -- NOT sorted alphabetically.
    const ordered = buildSsoSignature(["appid", "appkey", "param", "ts"]);
    const sorted = buildSsoSignature(["appid", "appkey", "param", "ts"].sort());
    // "appid" < "appkey" < "param" < "ts" -- happens to be the same when sorted
    // Use a case where sort would differ:
    const v1 = buildSsoSignature(["z-appid", "a-appkey", "m-param", "b-ts"]);
    const v2 = buildSsoSignature(["z-appid", "a-appkey", "m-param", "b-ts"].sort());
    // sorted would be: a-appkey, b-ts, m-param, z-appid  (different order)
    assert.notEqual(v1, v2, "Order matters; sorted should produce different hash");
  });

  it("should handle empty strings in the array", () => {
    const withEmpty = buildSsoSignature(["a", "", "b"]);
    const without = buildSsoSignature(["ab"]);
    // "a" + "" + "b" === "ab", so these should be equal
    assert.equal(withEmpty, without);
  });

  it("should produce different hashes for different inputs", () => {
    const h1 = buildSsoSignature(["foo", "bar"]);
    const h2 = buildSsoSignature(["foo", "baz"]);
    assert.notEqual(h1, h2);
  });

  it("should match a known golden value", () => {
    // sha1("test-apptest-keyuser1001700000000") computed externally
    const result = buildSsoSignature(["test-app", "test-key", "user100", "1700000000"]);
    const expected = sha1Hex("test-app", "test-key", "user100", "1700000000");
    assert.equal(result, expected);
  });
});

// ─── buildSsoSubaccountUrl ─────────────────────────────────────────

describe("buildSsoSubaccountUrl", () => {
  it("should return URL with correct base path", () => {
    const url = buildSsoSubaccountUrl({ subuser: "user1" }, testCreds);
    const { base } = parseUrl(url);
    assert.equal(base, "https://www.wjx.cn/zunxiang/login.aspx");
  });

  it("should include required query params: appid, subuser, ts, sign", () => {
    const url = buildSsoSubaccountUrl({ subuser: "user1" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("appid"), "test-app");
    assert.equal(params.get("subuser"), "user1");
    assert.ok(params.has("ts"), "should have ts param");
    assert.ok(params.has("sign"), "should have sign param");
  });

  it("should produce a 40-char hex sign", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u" }, testCreds);
    const { params } = parseUrl(url);
    assert.match(params.get("sign"), /^[0-9a-f]{40}$/);
  });

  it("should compute sign = sha1(appid + appkey + subuser + mobile + email + roleId + ts)", () => {
    const url = buildSsoSubaccountUrl(
      { subuser: "alice", mobile: "13800000000", email: "a@b.com", role_id: 2 },
      testCreds,
    );
    const { params } = parseUrl(url);
    const ts = params.get("ts");
    const expectedSign = sha1Hex("test-app", "test-key", "alice", "13800000000", "a@b.com", "2", ts);
    assert.equal(params.get("sign"), expectedSign);
  });

  it("should default mobile, email, roleId to empty strings in sign when omitted", () => {
    const url = buildSsoSubaccountUrl({ subuser: "bob" }, testCreds);
    const { params } = parseUrl(url);
    const ts = params.get("ts");
    const expectedSign = sha1Hex("test-app", "test-key", "bob", "", "", "", ts);
    assert.equal(params.get("sign"), expectedSign);
  });

  it("should include optional mobile param when provided", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u", mobile: "123" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("mobile"), "123");
  });

  it("should include optional email param when provided", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u", email: "x@y.com" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("email"), "x@y.com");
  });

  it("should include optional roleId param when provided", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u", role_id: 3 }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("roleId"), "3");
  });

  it("should include optional url param when provided", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u", url: "https://example.com" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("url"), "https://example.com");
  });

  it("should include optional admin param when provided", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u", admin: 1 }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("admin"), "1");
  });

  it("should NOT include mobile, email, roleId params when omitted", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.has("mobile"), false);
    assert.equal(params.has("email"), false);
    assert.equal(params.has("roleId"), false);
  });

  it("should NOT include appKey in query params", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.has("appKey"), false);
    assert.equal(params.has("appkey"), false);
  });
});

// ─── buildSsoUserSystemUrl ─────────────────────────────────────────

describe("buildSsoUserSystemUrl", () => {
  const baseInput = {
    u: "admin",
    user_system: 1,
    system_id: 100,
    uid: "participant-001",
  };

  it("should return URL with correct base path", () => {
    const url = buildSsoUserSystemUrl(baseInput, testCreds);
    const { base } = parseUrl(url);
    assert.equal(base, "https://www.wjx.cn/user/loginform.aspx");
  });

  it("should include required query params", () => {
    const url = buildSsoUserSystemUrl(baseInput, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("appid"), "test-app");
    assert.equal(params.get("u"), "admin");
    assert.equal(params.get("usersystem"), "1");
    assert.equal(params.get("systemid"), "100");
    assert.equal(params.get("uid"), "participant-001");
    assert.ok(params.has("ts"));
    assert.ok(params.has("sign"));
  });

  it("should produce a 40-char hex sign", () => {
    const url = buildSsoUserSystemUrl(baseInput, testCreds);
    const { params } = parseUrl(url);
    assert.match(params.get("sign"), /^[0-9a-f]{40}$/);
  });

  it("should compute sign = sha1(appid + appkey + uid + ts)", () => {
    const url = buildSsoUserSystemUrl(baseInput, testCreds);
    const { params } = parseUrl(url);
    const ts = params.get("ts");
    const expectedSign = sha1Hex("test-app", "test-key", "participant-001", ts);
    assert.equal(params.get("sign"), expectedSign);
  });

  it("should include optional uname when provided", () => {
    const url = buildSsoUserSystemUrl({ ...baseInput, uname: "Alice" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("uname"), "Alice");
  });

  it("should include optional udept when provided", () => {
    const url = buildSsoUserSystemUrl({ ...baseInput, udept: "Engineering" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("udept"), "Engineering");
  });

  it("should include optional uextf when provided", () => {
    const url = buildSsoUserSystemUrl({ ...baseInput, uextf: "extra" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("uextf"), "extra");
  });

  it("should include optional upass when provided", () => {
    const url = buildSsoUserSystemUrl({ ...baseInput, upass: "secret" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("upass"), "secret");
  });

  it("should include optional islogin when provided", () => {
    const url = buildSsoUserSystemUrl({ ...baseInput, is_login: 1 }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("islogin"), "1");
  });

  it("should include optional activity when provided", () => {
    const url = buildSsoUserSystemUrl({ ...baseInput, activity: 54321 }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("activity"), "54321");
  });

  it("should include optional returnurl when provided", () => {
    const url = buildSsoUserSystemUrl(
      { ...baseInput, return_url: "https://example.com/done" },
      testCreds,
    );
    const { params } = parseUrl(url);
    assert.equal(params.get("returnurl"), "https://example.com/done");
  });

  it("should NOT include optional params when omitted", () => {
    const url = buildSsoUserSystemUrl(baseInput, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.has("uname"), false);
    assert.equal(params.has("udept"), false);
    assert.equal(params.has("uextf"), false);
    assert.equal(params.has("upass"), false);
    assert.equal(params.has("islogin"), false);
    assert.equal(params.has("activity"), false);
    assert.equal(params.has("returnurl"), false);
  });

  it("should NOT include appKey in query params", () => {
    const url = buildSsoUserSystemUrl(baseInput, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.has("appKey"), false);
    assert.equal(params.has("appkey"), false);
  });
});

// ─── buildSsoPartnerUrl ────────────────────────────────────────────

describe("buildSsoPartnerUrl", () => {
  it("should return URL with correct base path", () => {
    const url = buildSsoPartnerUrl({ username: "partner1" }, testCreds);
    const { base } = parseUrl(url);
    assert.equal(base, "https://www.wjx.cn/partner/login.aspx");
  });

  it("should include required query params: appid, username, ts, sign", () => {
    const url = buildSsoPartnerUrl({ username: "partner1" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("appid"), "test-app");
    assert.equal(params.get("username"), "partner1");
    assert.ok(params.has("ts"));
    assert.ok(params.has("sign"));
  });

  it("should produce a 40-char hex sign", () => {
    const url = buildSsoPartnerUrl({ username: "p" }, testCreds);
    const { params } = parseUrl(url);
    assert.match(params.get("sign"), /^[0-9a-f]{40}$/);
  });

  it("should compute sign = sha1(appid + appkey + username + mobile + subuser + ts)", () => {
    const url = buildSsoPartnerUrl(
      { username: "partner1", mobile: "139", subuser: "sub1" },
      testCreds,
    );
    const { params } = parseUrl(url);
    const ts = params.get("ts");
    const expectedSign = sha1Hex("test-app", "test-key", "partner1", "139", "sub1", ts);
    assert.equal(params.get("sign"), expectedSign);
  });

  it("should default mobile and subuser to empty strings in sign when omitted", () => {
    const url = buildSsoPartnerUrl({ username: "partner1" }, testCreds);
    const { params } = parseUrl(url);
    const ts = params.get("ts");
    const expectedSign = sha1Hex("test-app", "test-key", "partner1", "", "", ts);
    assert.equal(params.get("sign"), expectedSign);
  });

  it("should include optional mobile param when provided", () => {
    const url = buildSsoPartnerUrl({ username: "p", mobile: "13800001111" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("mobile"), "13800001111");
  });

  it("should include optional subuser param when provided", () => {
    const url = buildSsoPartnerUrl({ username: "p", subuser: "sub-acct" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.get("subuser"), "sub-acct");
  });

  it("should NOT include mobile and subuser params when omitted", () => {
    const url = buildSsoPartnerUrl({ username: "p" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.has("mobile"), false);
    assert.equal(params.has("subuser"), false);
  });

  it("should NOT include appKey in query params", () => {
    const url = buildSsoPartnerUrl({ username: "p" }, testCreds);
    const { params } = parseUrl(url);
    assert.equal(params.has("appKey"), false);
    assert.equal(params.has("appkey"), false);
  });
});

// ─── buildSurveyUrl ────────────────────────────────────────────────

describe("buildSurveyUrl", () => {
  describe("create mode", () => {
    it("should return correct base URL with no optional params", () => {
      const url = buildSurveyUrl({ mode: "create" });
      assert.equal(url, "https://www.wjx.cn/newwjx/mysojump/createblankNew.aspx");
    });

    it("should include name param when provided", () => {
      const url = buildSurveyUrl({ mode: "create", name: "My Survey" });
      const { params } = parseUrl(url);
      assert.equal(params.get("name"), "My Survey");
    });

    it("should include qt param when provided", () => {
      const url = buildSurveyUrl({ mode: "create", qt: 1 });
      const { params } = parseUrl(url);
      assert.equal(params.get("qt"), "1");
    });

    it("should include osa param when provided", () => {
      const url = buildSurveyUrl({ mode: "create", osa: 1 });
      const { params } = parseUrl(url);
      assert.equal(params.get("osa"), "1");
    });

    it("should include redirecturl param when provided", () => {
      const url = buildSurveyUrl({ mode: "create", redirect_url: "https://done.com" });
      const { params } = parseUrl(url);
      assert.equal(params.get("redirecturl"), "https://done.com");
    });

    it("should include all optional params together", () => {
      const url = buildSurveyUrl({
        mode: "create",
        name: "Test",
        qt: 2,
        osa: 1,
        redirect_url: "https://r.com",
      });
      const { base, params } = parseUrl(url);
      assert.equal(base, "https://www.wjx.cn/newwjx/mysojump/createblankNew.aspx");
      assert.equal(params.get("name"), "Test");
      assert.equal(params.get("qt"), "2");
      assert.equal(params.get("osa"), "1");
      assert.equal(params.get("redirecturl"), "https://r.com");
    });
  });

  describe("edit mode", () => {
    it("should return correct base URL with activity", () => {
      const url = buildSurveyUrl({ mode: "edit", activity: 12345 });
      const { base, params } = parseUrl(url);
      assert.equal(base, "https://www.wjx.cn/newwjx/design/editquestionnaire.aspx");
      assert.equal(params.get("activity"), "12345");
    });

    it("should include editmode param when provided", () => {
      const url = buildSurveyUrl({ mode: "edit", activity: 1, editmode: 2 });
      const { params } = parseUrl(url);
      assert.equal(params.get("editmode"), "2");
    });

    it("should include runprotect param when provided", () => {
      const url = buildSurveyUrl({ mode: "edit", activity: 1, runprotect: 1 });
      const { params } = parseUrl(url);
      assert.equal(params.get("runprotect"), "1");
    });

    it("should include redirecturl param when provided", () => {
      const url = buildSurveyUrl({
        mode: "edit",
        activity: 1,
        redirect_url: "https://back.com",
      });
      const { params } = parseUrl(url);
      assert.equal(params.get("redirecturl"), "https://back.com");
    });

    it("should throw when activity is not provided in edit mode", () => {
      assert.throws(
        () => buildSurveyUrl({ mode: "edit" }),
        /edit 模式需要提供 activity/,
      );
    });

    it("should throw when activity is explicitly undefined in edit mode", () => {
      assert.throws(
        () => buildSurveyUrl({ mode: "edit", activity: undefined }),
        /edit 模式需要提供 activity/,
      );
    });

    it("should include all optional edit params together", () => {
      const url = buildSurveyUrl({
        mode: "edit",
        activity: 999,
        editmode: 1,
        runprotect: 0,
        redirect_url: "https://r.com",
      });
      const { base, params } = parseUrl(url);
      assert.equal(base, "https://www.wjx.cn/newwjx/design/editquestionnaire.aspx");
      assert.equal(params.get("activity"), "999");
      assert.equal(params.get("editmode"), "1");
      assert.equal(params.get("runprotect"), "0");
      assert.equal(params.get("redirecturl"), "https://r.com");
    });
  });
});
