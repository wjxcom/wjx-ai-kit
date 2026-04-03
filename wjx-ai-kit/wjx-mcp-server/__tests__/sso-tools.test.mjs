import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";

// Set dummy env vars
process.env.WJX_APP_ID = process.env.WJX_APP_ID || "test-app-id";
process.env.WJX_APP_KEY = process.env.WJX_APP_KEY || "test-app-key";

async function createTestClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "1.0" });
  await client.connect(clientTransport);
  return { client, server };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SSO Tools — Full Test Suite
// ═══════════════════════════════════════════════════════════════════════════════

describe("SSO tools via MCP", () => {
  let client;
  before(async () => {
    ({ client } = await createTestClient());
  });

  // ═══ 1. sso_subaccount_url ═══════════════════════════════════════════════

  describe("sso_subaccount_url", () => {
    it("1.1 基本参数: 仅 subuser", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: { subuser: "testuser" },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.result, true);
      assert.ok(data.url, "应返回 URL");
      assert.ok(data.url.includes("/zunxiang/login.aspx"), "URL 应包含子账号 SSO 路径");
      assert.ok(data.url.includes("subuser=testuser"), "URL 应包含 subuser 参数");
      console.log("  返回 URL:", data.url);
    });

    it("1.2 完整参数: subuser + mobile + email + role_id + url", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: {
          subuser: "testuser",
          mobile: "13800138000",
          email: "test@test.com",
          role_id: 2,
          url: "/dashboard",
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.result, true);
      const url = data.url;
      assert.ok(url.includes("subuser=testuser"), "URL 应包含 subuser");
      assert.ok(url.includes("mobile=13800138000"), "URL 应包含 mobile");
      assert.ok(url.includes("email=test%40test.com") || url.includes("email=test@test.com"), "URL 应包含 email");
      assert.ok(url.includes("roleId=2"), "URL 应包含 roleId");
      assert.ok(url.includes("url="), "URL 应包含 url 参数");
      console.log("  返回 URL:", url);
    });

    it("1.3 admin=1 以主账号身份登录", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: { subuser: "testuser", admin: 1 },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url.includes("admin=1"), "URL 应包含 admin=1");
      console.log("  返回 URL:", data.url);
    });

    it("1.4 缺少必填参数 subuser 应报错", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: {},
      });
      assert.equal(result.isError, true, "缺少必填参数应报错");
      console.log("  错误信息:", result.content[0].text);
    });

    it("1.5 subuser 为空字符串应报错", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: { subuser: "" },
      });
      assert.equal(result.isError, true, "空字符串 subuser 应报错");
      console.log("  错误信息:", result.content[0].text);
    });

    it("1.6 role_id 边界值: 1 (最小有效值)", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: { subuser: "testuser", role_id: 1 },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url.includes("roleId=1"), "URL 应包含 roleId=1");
    });

    it("1.7 role_id 边界值: 4 (最大有效值)", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: { subuser: "testuser", role_id: 4 },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url.includes("roleId=4"), "URL 应包含 roleId=4");
    });

    it("1.8 role_id 超出范围: 0 应报错", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: { subuser: "testuser", role_id: 0 },
      });
      assert.equal(result.isError, true, "role_id=0 超出范围应报错");
    });

    it("1.9 role_id 超出范围: 5 应报错", async () => {
      const result = await client.callTool({
        name: "sso_subaccount_url",
        arguments: { subuser: "testuser", role_id: 5 },
      });
      assert.equal(result.isError, true, "role_id=5 超出范围应报错");
    });
  });

  // ═══ 2. sso_user_system_url ═══════════════════════════════════════════════

  describe("sso_user_system_url", () => {
    it("2.1 基本参数: u + system_id + uid", async () => {
      const result = await client.callTool({
        name: "sso_user_system_url",
        arguments: {
          u: "admin",
          system_id: 1,
          uid: "user001",
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.result, true);
      assert.ok(data.url.includes("/user/loginform.aspx"), "URL 应包含用户系统 SSO 路径");
      assert.ok(data.url.includes("u=admin"), "URL 应包含 u 参数");
      assert.ok(data.url.includes("systemid=1"), "URL 应包含 systemid 参数");
      assert.ok(data.url.includes("uid=user001"), "URL 应包含 uid 参数");
      assert.ok(data.url.includes("usersystem=1"), "URL 应包含 usersystem=1");
      console.log("  返回 URL:", data.url);
    });

    it("2.2 完整参数: 所有可选参数", async () => {
      const result = await client.callTool({
        name: "sso_user_system_url",
        arguments: {
          u: "admin",
          system_id: 1,
          uid: "user001",
          uname: "张三",
          udept: "技术部",
          uextf: "ext-field-value",
          upass: "pass123",
          is_login: 1,
          activity: 203725,
          return_url: "https://example.com/callback",
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      const url = data.url;
      assert.ok(url.includes("u=admin"), "URL 应包含 u");
      assert.ok(url.includes("uid=user001"), "URL 应包含 uid");
      assert.ok(url.includes("uname="), "URL 应包含 uname");
      assert.ok(url.includes("udept="), "URL 应包含 udept");
      assert.ok(url.includes("uextf=ext-field-value"), "URL 应包含 uextf");
      assert.ok(url.includes("upass=pass123"), "URL 应包含 upass");
      assert.ok(url.includes("islogin=1"), "URL 应包含 islogin");
      assert.ok(url.includes("activity=203725"), "URL 应包含 activity");
      assert.ok(url.includes("returnurl="), "URL 应包含 returnurl");
      console.log("  返回 URL:", url);
    });

    it("2.3 user_system 默认值应为 1", async () => {
      const result = await client.callTool({
        name: "sso_user_system_url",
        arguments: {
          u: "admin",
          system_id: 5,
          uid: "user002",
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url.includes("usersystem=1"), "user_system 默认值应为 1");
    });

    it("2.4 缺少必填参数 u 应报错", async () => {
      const result = await client.callTool({
        name: "sso_user_system_url",
        arguments: {
          system_id: 1,
          uid: "user001",
        },
      });
      assert.equal(result.isError, true, "缺少 u 应报错");
    });

    it("2.5 缺少必填参数 system_id 应报错", async () => {
      const result = await client.callTool({
        name: "sso_user_system_url",
        arguments: {
          u: "admin",
          uid: "user001",
        },
      });
      assert.equal(result.isError, true, "缺少 system_id 应报错");
    });

    it("2.6 缺少必填参数 uid 应报错", async () => {
      const result = await client.callTool({
        name: "sso_user_system_url",
        arguments: {
          u: "admin",
          system_id: 1,
        },
      });
      assert.equal(result.isError, true, "缺少 uid 应报错");
    });

    it("2.7 is_login=0 应正确生成", async () => {
      const result = await client.callTool({
        name: "sso_user_system_url",
        arguments: {
          u: "admin",
          system_id: 1,
          uid: "user001",
          is_login: 0,
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url.includes("islogin=0"), "URL 应包含 islogin=0");
    });

    it("2.8 中文参数编码测试", async () => {
      const result = await client.callTool({
        name: "sso_user_system_url",
        arguments: {
          u: "admin",
          system_id: 1,
          uid: "user001",
          uname: "张三",
          udept: "技术部/后端组",
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      // URLSearchParams 应自动编码中文
      assert.ok(data.url.includes("uname="), "URL 应包含编码后的 uname");
      assert.ok(data.url.includes("udept="), "URL 应包含编码后的 udept");
      console.log("  中文编码 URL:", data.url);
    });
  });

  // ═══ 3. sso_partner_url ═══════════════════════════════════════════════════

  describe("sso_partner_url", () => {
    it("3.1 基本参数: 仅 username", async () => {
      const result = await client.callTool({
        name: "sso_partner_url",
        arguments: { username: "partner1" },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.result, true);
      assert.ok(data.url.includes("/partner/login.aspx"), "URL 应包含合作伙伴 SSO 路径");
      assert.ok(data.url.includes("username=partner1"), "URL 应包含 username");
      console.log("  返回 URL:", data.url);
    });

    it("3.2 完整参数: username + mobile + subuser", async () => {
      const result = await client.callTool({
        name: "sso_partner_url",
        arguments: {
          username: "partner1",
          mobile: "13800138000",
          subuser: "sub1",
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      const url = data.url;
      assert.ok(url.includes("username=partner1"), "URL 应包含 username");
      assert.ok(url.includes("mobile=13800138000"), "URL 应包含 mobile");
      assert.ok(url.includes("subuser=sub1"), "URL 应包含 subuser");
      console.log("  返回 URL:", url);
    });

    it("3.3 缺少必填参数 username 应报错", async () => {
      const result = await client.callTool({
        name: "sso_partner_url",
        arguments: {},
      });
      assert.equal(result.isError, true, "缺少 username 应报错");
    });

    it("3.4 username 为空字符串应报错", async () => {
      const result = await client.callTool({
        name: "sso_partner_url",
        arguments: { username: "" },
      });
      assert.equal(result.isError, true, "空字符串 username 应报错");
    });

    it("3.5 仅 username + mobile", async () => {
      const result = await client.callTool({
        name: "sso_partner_url",
        arguments: { username: "partner1", mobile: "13800138000" },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url.includes("username=partner1"));
      assert.ok(data.url.includes("mobile=13800138000"));
      assert.ok(!data.url.includes("subuser="), "不应包含未设置的 subuser");
    });

    it("3.6 仅 username + subuser", async () => {
      const result = await client.callTool({
        name: "sso_partner_url",
        arguments: { username: "partner1", subuser: "sub1" },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url.includes("username=partner1"));
      assert.ok(data.url.includes("subuser=sub1"));
      assert.ok(!data.url.includes("mobile="), "不应包含未设置的 mobile");
    });
  });

  // ═══ 4. build_survey_url ══════════════════════════════════════════════════

  describe("build_survey_url", () => {
    // ── 创建模式 ──
    it("4.1 创建模式: 仅 mode=create", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: { mode: "create" },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.equal(data.result, true);
      assert.ok(data.url.includes("/newwjx/mysojump/createblankNew.aspx"), "URL 应包含创建路径");
      console.log("  创建模式基本 URL:", data.url);
    });

    it("4.2 创建模式: name + qt + osa", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: {
          mode: "create",
          name: "测试问卷",
          qt: 1,
          osa: 1,
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      const url = data.url;
      assert.ok(url.includes("name="), "URL 应包含 name");
      assert.ok(url.includes("qt=1"), "URL 应包含 qt=1");
      assert.ok(url.includes("osa=1"), "URL 应包含 osa=1");
      console.log("  创建模式完整 URL:", url);
    });

    it("4.3 创建模式: 带 redirect_url", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: {
          mode: "create",
          name: "测试问卷",
          redirect_url: "https://example.com/done",
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url.includes("redirecturl="), "URL 应包含 redirecturl");
    });

    it("4.4 创建模式: qt=6 (考试类型)", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: { mode: "create", name: "考试", qt: 6 },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url.includes("qt=6"), "URL 应包含 qt=6");
    });

    // ── 编辑模式 ──
    it("4.5 编辑模式: mode=edit + activity", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: { mode: "edit", activity: 203725 },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url.includes("/newwjx/design/editquestionnaire.aspx"), "URL 应包含编辑路径");
      assert.ok(data.url.includes("activity=203725"), "URL 应包含 activity");
      console.log("  编辑模式 URL:", data.url);
    });

    it("4.6 编辑模式: 缺少 activity 应报错", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: { mode: "edit" },
      });
      assert.equal(result.isError, true, "编辑模式缺少 activity 应报错");
      console.log("  错误信息:", result.content[0].text);
    });

    it("4.7 编辑模式: 带 editmode 和 runprotect", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: {
          mode: "edit",
          activity: 203725,
          editmode: 1,
          runprotect: 1,
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url.includes("editmode=1"), "URL 应包含 editmode");
      assert.ok(data.url.includes("runprotect=1"), "URL 应包含 runprotect");
    });

    it("4.8 编辑模式: 带 redirect_url", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: {
          mode: "edit",
          activity: 203725,
          redirect_url: "https://example.com/edited",
        },
      });
      assert.equal(result.isError, false);
      const data = JSON.parse(result.content[0].text);
      assert.ok(data.url.includes("redirecturl="), "URL 应包含 redirecturl");
      assert.ok(data.url.includes("activity=203725"), "URL 应包含 activity");
    });

    // ── 无效模式 ──
    it("4.9 无效 mode 值应报错", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: { mode: "delete" },
      });
      assert.equal(result.isError, true, "无效 mode 值应报错");
    });

    it("4.10 缺少 mode 参数应报错", async () => {
      const result = await client.callTool({
        name: "build_survey_url",
        arguments: {},
      });
      assert.equal(result.isError, true, "缺少 mode 应报错");
    });
  });
});
