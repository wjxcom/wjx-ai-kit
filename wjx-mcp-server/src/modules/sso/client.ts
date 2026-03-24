import { getWjxCredentials, getUnixTimestamp } from "../../core/api-client.js";
import { buildSsoSignature } from "./sign.js";
import type { WjxCredentials } from "../../core/types.js";
import type {
  SsoSubaccountInput,
  SsoUserSystemInput,
  SsoPartnerInput,
  BuildSurveyUrlInput,
} from "./types.js";

/**
 * Build sub-account SSO login/create URL.
 * sign = sha1(appid + appkey + subuser + mobile + email + roleId + ts)
 */
export function buildSsoSubaccountUrl(
  input: SsoSubaccountInput,
  credentials?: WjxCredentials,
): string {
  const creds = credentials ?? getWjxCredentials();
  const ts = getUnixTimestamp();
  const mobile = input.mobile ?? "";
  const email = input.email ?? "";
  const roleId = input.role_id?.toString() ?? "";

  const sign = buildSsoSignature([
    creds.appId,
    creds.appKey,
    input.subuser,
    mobile,
    email,
    roleId,
    ts,
  ]);

  const params = new URLSearchParams();
  params.set("appid", creds.appId);
  params.set("subuser", input.subuser);
  params.set("ts", ts);
  params.set("sign", sign);
  if (mobile) params.set("mobile", mobile);
  if (email) params.set("email", email);
  if (roleId) params.set("roleId", roleId);
  if (input.url !== undefined) params.set("url", input.url);
  if (input.admin !== undefined) params.set("admin", input.admin.toString());

  return `https://www.wjx.cn/zunxiang/login.aspx?${params.toString()}`;
}

/**
 * Build user system participant SSO URL.
 * sign = sha1(appid + appkey + uid + ts)
 */
export function buildSsoUserSystemUrl(
  input: SsoUserSystemInput,
  credentials?: WjxCredentials,
): string {
  const creds = credentials ?? getWjxCredentials();
  const ts = getUnixTimestamp();

  const sign = buildSsoSignature([creds.appId, creds.appKey, input.uid, ts]);

  const userSystem = input.user_system ?? 1;

  const params = new URLSearchParams();
  params.set("appid", creds.appId);
  params.set("u", input.u);
  params.set("usersystem", userSystem.toString());
  params.set("systemid", input.system_id.toString());
  params.set("uid", input.uid);
  params.set("ts", ts);
  params.set("sign", sign);
  if (input.uname !== undefined) params.set("uname", input.uname);
  if (input.udept !== undefined) params.set("udept", input.udept);
  if (input.uextf !== undefined) params.set("uextf", input.uextf);
  if (input.upass !== undefined) params.set("upass", input.upass);
  if (input.is_login !== undefined) params.set("islogin", input.is_login.toString());
  if (input.activity !== undefined) params.set("activity", input.activity.toString());
  if (input.return_url !== undefined) params.set("returnurl", input.return_url);

  return `https://www.wjx.cn/user/loginform.aspx?${params.toString()}`;
}

/**
 * Build partner/agent SSO login URL.
 * sign = sha1(appid + appkey + username + mobile + subuser + ts)
 */
export function buildSsoPartnerUrl(
  input: SsoPartnerInput,
  credentials?: WjxCredentials,
): string {
  const creds = credentials ?? getWjxCredentials();
  const ts = getUnixTimestamp();
  const mobile = input.mobile ?? "";
  const subuser = input.subuser ?? "";

  const sign = buildSsoSignature([
    creds.appId,
    creds.appKey,
    input.username,
    mobile,
    subuser,
    ts,
  ]);

  const params = new URLSearchParams();
  params.set("appid", creds.appId);
  params.set("username", input.username);
  params.set("ts", ts);
  params.set("sign", sign);
  if (mobile) params.set("mobile", mobile);
  if (subuser) params.set("subuser", subuser);

  return `https://www.wjx.cn/partner/login.aspx?${params.toString()}`;
}

/**
 * Build quick create/edit survey URL (no signing needed).
 */
export function buildSurveyUrl(input: BuildSurveyUrlInput): string {
  if (input.mode === "create") {
    const params = new URLSearchParams();
    if (input.name !== undefined) params.set("name", input.name);
    if (input.qt !== undefined) params.set("qt", input.qt.toString());
    if (input.osa !== undefined) params.set("osa", input.osa.toString());
    if (input.redirect_url !== undefined) params.set("redirecturl", input.redirect_url);

    const qs = params.toString();
    const base = "https://www.wjx.cn/newwjx/mysojump/createblankNew.aspx";
    return qs ? `${base}?${qs}` : base;
  }

  // edit mode
  if (input.activity === undefined) {
    throw new Error("edit 模式需要提供 activity（问卷编号）");
  }

  const params = new URLSearchParams();
  params.set("activity", input.activity.toString());
  if (input.editmode !== undefined) params.set("editmode", input.editmode.toString());
  if (input.runprotect !== undefined) params.set("runprotect", input.runprotect.toString());
  if (input.redirect_url !== undefined) params.set("redirecturl", input.redirect_url);

  return `https://www.wjx.cn/newwjx/design/editquestionnaire.aspx?${params.toString()}`;
}
