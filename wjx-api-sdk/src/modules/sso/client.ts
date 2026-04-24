import {
  getWjxBaseUrl,
  getWjxSsoSubaccountUrl,
  getWjxSsoUserSystemUrl,
  getWjxSsoPartnerUrl,
  getWjxSurveyCreateUrl,
  getWjxSurveyEditUrl,
} from "../../core/constants.js";
import type {
  SsoSubaccountInput,
  SsoUserSystemInput,
  SsoPartnerInput,
  BuildSurveyUrlInput,
  BuildPreviewUrlInput,
} from "./types.js";

/**
 * Build sub-account SSO login/create URL.
 */
export function buildSsoSubaccountUrl(
  input: SsoSubaccountInput,
): string {
  const params = new URLSearchParams();
  params.set("subuser", input.subuser);
  if (input.mobile) params.set("mobile", input.mobile);
  if (input.email) params.set("email", input.email);
  if (input.role_id !== undefined) params.set("roleId", input.role_id.toString());
  if (input.url !== undefined) params.set("url", input.url);
  if (input.admin !== undefined) params.set("admin", input.admin.toString());

  return `${getWjxSsoSubaccountUrl()}?${params.toString()}`;
}

/**
 * Build user system participant SSO URL.
 */
export function buildSsoUserSystemUrl(
  input: SsoUserSystemInput,
): string {
  const userSystem = input.user_system ?? 1;

  const params = new URLSearchParams();
  params.set("u", input.u);
  params.set("usersystem", userSystem.toString());
  params.set("systemid", input.system_id.toString());
  params.set("uid", input.uid);
  if (input.uname !== undefined) params.set("uname", input.uname);
  if (input.udept !== undefined) params.set("udept", input.udept);
  if (input.uextf !== undefined) params.set("uextf", input.uextf);
  if (input.upass !== undefined) params.set("upass", input.upass);
  if (input.is_login !== undefined) params.set("islogin", input.is_login.toString());
  if (input.activity !== undefined) params.set("activity", input.activity.toString());
  if (input.return_url !== undefined) params.set("returnurl", input.return_url);

  return `${getWjxSsoUserSystemUrl()}?${params.toString()}`;
}

/**
 * Build partner/agent SSO login URL.
 */
export function buildSsoPartnerUrl(
  input: SsoPartnerInput,
): string {
  const params = new URLSearchParams();
  params.set("username", input.username);
  if (input.mobile) params.set("mobile", input.mobile);
  if (input.subuser) params.set("subuser", input.subuser);

  return `${getWjxSsoPartnerUrl()}?${params.toString()}`;
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
    const base = getWjxSurveyCreateUrl();
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

  return `${getWjxSurveyEditUrl()}?${params.toString()}`;
}

/**
 * Build a survey preview/fill URL (the respondent-facing page).
 * Pattern: {baseUrl}/vm/{sid|vid}.aspx
 */
export function buildPreviewUrl(input: BuildPreviewUrlInput): string {
  const sid = input.sid?.trim();
  const vid = input.vid;
  const hasValidVid =
    vid !== undefined && Number.isInteger(vid) && vid > 0;
  if (!sid && vid !== undefined && !hasValidVid) {
    throw new Error("buildPreviewUrl 的 vid 必须是正整数");
  }
  const target = sid || (hasValidVid ? vid.toString() : "");
  if (!target) {
    throw new Error("buildPreviewUrl 需要提供 sid 或 vid");
  }

  const base = `${getWjxBaseUrl()}/vm/${encodeURIComponent(target)}.aspx`;
  if (input.source) {
    return `${base}?source=${encodeURIComponent(input.source)}`;
  }
  return base;
}
