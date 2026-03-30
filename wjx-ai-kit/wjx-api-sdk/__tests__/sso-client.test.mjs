import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSsoSubaccountUrl,
  buildSsoUserSystemUrl,
  buildSsoPartnerUrl,
  buildSurveyUrl,
} from "../dist/index.js";

/** Parse a URL string and return { base, params } for easy assertions. */
function parseUrl(urlStr) {
  const url = new URL(urlStr);
  return { base: url.origin + url.pathname, params: url.searchParams };
}

// ─── buildSsoSubaccountUrl ─────────────────────────────────────────
// In the new model, SSO URL builders no longer take credentials or compute signatures.
// They just build the URL with the provided input params.

describe("buildSsoSubaccountUrl", () => {
  it("should return URL with correct base path", () => {
    const url = buildSsoSubaccountUrl({ subuser: "user1" });
    const { base } = parseUrl(url);
    assert.equal(base, "https://www.wjx.cn/zunxiang/login.aspx");
  });

  it("should include subuser param", () => {
    const url = buildSsoSubaccountUrl({ subuser: "user1" });
    const { params } = parseUrl(url);
    assert.equal(params.get("subuser"), "user1");
  });

  it("should NOT include appid, ts, or sign (no signing in new model)", () => {
    const url = buildSsoSubaccountUrl({ subuser: "user1" });
    const { params } = parseUrl(url);
    assert.equal(params.has("appid"), false);
    assert.equal(params.has("ts"), false);
    assert.equal(params.has("sign"), false);
  });

  it("should include optional mobile param when provided", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u", mobile: "123" });
    const { params } = parseUrl(url);
    assert.equal(params.get("mobile"), "123");
  });

  it("should include optional email param when provided", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u", email: "x@y.com" });
    const { params } = parseUrl(url);
    assert.equal(params.get("email"), "x@y.com");
  });

  it("should include optional roleId param when provided", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u", role_id: 3 });
    const { params } = parseUrl(url);
    assert.equal(params.get("roleId"), "3");
  });

  it("should include optional url param when provided", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u", url: "https://example.com" });
    const { params } = parseUrl(url);
    assert.equal(params.get("url"), "https://example.com");
  });

  it("should include optional admin param when provided", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u", admin: 1 });
    const { params } = parseUrl(url);
    assert.equal(params.get("admin"), "1");
  });

  it("should NOT include mobile, email, roleId params when omitted", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u" });
    const { params } = parseUrl(url);
    assert.equal(params.has("mobile"), false);
    assert.equal(params.has("email"), false);
    assert.equal(params.has("roleId"), false);
  });

  it("should NOT include appKey in query params", () => {
    const url = buildSsoSubaccountUrl({ subuser: "u" });
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
    const url = buildSsoUserSystemUrl(baseInput);
    const { base } = parseUrl(url);
    assert.equal(base, "https://www.wjx.cn/user/loginform.aspx");
  });

  it("should include required query params (no signing)", () => {
    const url = buildSsoUserSystemUrl(baseInput);
    const { params } = parseUrl(url);
    assert.equal(params.get("u"), "admin");
    assert.equal(params.get("usersystem"), "1");
    assert.equal(params.get("systemid"), "100");
    assert.equal(params.get("uid"), "participant-001");
    // No appid, ts, sign in new model
    assert.equal(params.has("appid"), false);
    assert.equal(params.has("ts"), false);
    assert.equal(params.has("sign"), false);
  });

  it("should include optional uname when provided", () => {
    const url = buildSsoUserSystemUrl({ ...baseInput, uname: "Alice" });
    const { params } = parseUrl(url);
    assert.equal(params.get("uname"), "Alice");
  });

  it("should include optional udept when provided", () => {
    const url = buildSsoUserSystemUrl({ ...baseInput, udept: "Engineering" });
    const { params } = parseUrl(url);
    assert.equal(params.get("udept"), "Engineering");
  });

  it("should include optional uextf when provided", () => {
    const url = buildSsoUserSystemUrl({ ...baseInput, uextf: "extra" });
    const { params } = parseUrl(url);
    assert.equal(params.get("uextf"), "extra");
  });

  it("should include optional upass when provided", () => {
    const url = buildSsoUserSystemUrl({ ...baseInput, upass: "secret" });
    const { params } = parseUrl(url);
    assert.equal(params.get("upass"), "secret");
  });

  it("should include optional islogin when provided", () => {
    const url = buildSsoUserSystemUrl({ ...baseInput, is_login: 1 });
    const { params } = parseUrl(url);
    assert.equal(params.get("islogin"), "1");
  });

  it("should include optional activity when provided", () => {
    const url = buildSsoUserSystemUrl({ ...baseInput, activity: 54321 });
    const { params } = parseUrl(url);
    assert.equal(params.get("activity"), "54321");
  });

  it("should include optional returnurl when provided", () => {
    const url = buildSsoUserSystemUrl(
      { ...baseInput, return_url: "https://example.com/done" },
    );
    const { params } = parseUrl(url);
    assert.equal(params.get("returnurl"), "https://example.com/done");
  });

  it("should NOT include optional params when omitted", () => {
    const url = buildSsoUserSystemUrl(baseInput);
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
    const url = buildSsoUserSystemUrl(baseInput);
    const { params } = parseUrl(url);
    assert.equal(params.has("appKey"), false);
    assert.equal(params.has("appkey"), false);
  });
});

// ─── buildSsoPartnerUrl ────────────────────────────────────────────

describe("buildSsoPartnerUrl", () => {
  it("should return URL with correct base path", () => {
    const url = buildSsoPartnerUrl({ username: "partner1" });
    const { base } = parseUrl(url);
    assert.equal(base, "https://www.wjx.cn/partner/login.aspx");
  });

  it("should include username param (no signing)", () => {
    const url = buildSsoPartnerUrl({ username: "partner1" });
    const { params } = parseUrl(url);
    assert.equal(params.get("username"), "partner1");
    assert.equal(params.has("appid"), false);
    assert.equal(params.has("ts"), false);
    assert.equal(params.has("sign"), false);
  });

  it("should include optional mobile param when provided", () => {
    const url = buildSsoPartnerUrl({ username: "p", mobile: "13800001111" });
    const { params } = parseUrl(url);
    assert.equal(params.get("mobile"), "13800001111");
  });

  it("should include optional subuser param when provided", () => {
    const url = buildSsoPartnerUrl({ username: "p", subuser: "sub-acct" });
    const { params } = parseUrl(url);
    assert.equal(params.get("subuser"), "sub-acct");
  });

  it("should NOT include mobile and subuser params when omitted", () => {
    const url = buildSsoPartnerUrl({ username: "p" });
    const { params } = parseUrl(url);
    assert.equal(params.has("mobile"), false);
    assert.equal(params.has("subuser"), false);
  });

  it("should NOT include appKey in query params", () => {
    const url = buildSsoPartnerUrl({ username: "p" });
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
