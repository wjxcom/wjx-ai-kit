function normalizeBaseUrl(baseUrl) {
    const trimmed = baseUrl.trim().replace(/\/+$/, "");
    try {
        const parsed = new URL(trimmed);
        if (/^\/openapi\/[^/]+\.aspx$/i.test(parsed.pathname))
            return parsed.origin;
    }
    catch {
        // Preserve malformed values so fetch reports the caller's configuration error.
    }
    return trimmed;
}
function nonBlank(value) {
    const trimmed = value?.trim();
    return trimmed || undefined;
}
function envValue(name) {
    const value = process.env[name];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
export function getWjxBaseUrl(baseUrl) {
    return normalizeBaseUrl(nonBlank(baseUrl) ?? envValue("WJX_BASE_URL") ?? "https://www.wjx.cn");
}
export function getWjxApiUrl(baseUrl) {
    const explicitBaseUrl = nonBlank(baseUrl);
    return explicitBaseUrl
        ? `${getWjxBaseUrl(explicitBaseUrl)}/openapi/default.aspx`
        : envValue("WJX_API_URL") ?? `${getWjxBaseUrl()}/openapi/default.aspx`;
}
export function getWjxUserSystemApiUrl(baseUrl) {
    const explicitBaseUrl = nonBlank(baseUrl);
    return explicitBaseUrl
        ? `${getWjxBaseUrl(explicitBaseUrl)}/openapi/usersystem.aspx`
        : envValue("WJX_USER_SYSTEM_API_URL") ?? `${getWjxBaseUrl()}/openapi/usersystem.aspx`;
}
export function getWjxSubuserApiUrl(baseUrl) {
    const explicitBaseUrl = nonBlank(baseUrl);
    return explicitBaseUrl
        ? `${getWjxBaseUrl(explicitBaseUrl)}/openapi/subuser.aspx`
        : envValue("WJX_SUBUSER_API_URL") ?? `${getWjxBaseUrl()}/openapi/subuser.aspx`;
}
export function getWjxContactsApiUrl(baseUrl) {
    const explicitBaseUrl = nonBlank(baseUrl);
    return explicitBaseUrl
        ? `${getWjxBaseUrl(explicitBaseUrl)}/openapi/contacts.aspx`
        : envValue("WJX_CONTACTS_API_URL") ?? `${getWjxBaseUrl()}/openapi/contacts.aspx`;
}
export function getWjxSsoSubaccountUrl(baseUrl) {
    const explicitBaseUrl = nonBlank(baseUrl);
    return explicitBaseUrl
        ? `${getWjxBaseUrl(explicitBaseUrl)}/zunxiang/login.aspx`
        : envValue("WJX_SSO_SUBACCOUNT_URL") ?? `${getWjxBaseUrl()}/zunxiang/login.aspx`;
}
export function getWjxSsoUserSystemUrl(baseUrl) {
    const explicitBaseUrl = nonBlank(baseUrl);
    return explicitBaseUrl
        ? `${getWjxBaseUrl(explicitBaseUrl)}/user/loginform.aspx`
        : envValue("WJX_SSO_USER_SYSTEM_URL") ?? `${getWjxBaseUrl()}/user/loginform.aspx`;
}
export function getWjxSsoPartnerUrl(baseUrl) {
    const explicitBaseUrl = nonBlank(baseUrl);
    return explicitBaseUrl
        ? `${getWjxBaseUrl(explicitBaseUrl)}/partner/login.aspx`
        : envValue("WJX_SSO_PARTNER_URL") ?? `${getWjxBaseUrl()}/partner/login.aspx`;
}
export function getWjxSurveyCreateUrl(baseUrl) {
    const explicitBaseUrl = nonBlank(baseUrl);
    return explicitBaseUrl
        ? `${getWjxBaseUrl(explicitBaseUrl)}/newwjx/mysojump/createblankNew.aspx`
        : envValue("WJX_SURVEY_CREATE_URL") ?? `${getWjxBaseUrl()}/newwjx/mysojump/createblankNew.aspx`;
}
export function getWjxSurveyEditUrl(baseUrl) {
    const explicitBaseUrl = nonBlank(baseUrl);
    return explicitBaseUrl
        ? `${getWjxBaseUrl(explicitBaseUrl)}/newwjx/design/editquestionnaire.aspx`
        : envValue("WJX_SURVEY_EDIT_URL") ?? `${getWjxBaseUrl()}/newwjx/design/editquestionnaire.aspx`;
}
export const Action = {
    GET_SURVEY: "1000001",
    LIST_SURVEYS: "1000002",
    GET_SETTINGS: "1000003",
    GET_TAGS: "1000004",
    GET_TAG_DETAILS: "1000005",
    UPDATE_STATUS: "1000102",
    UPDATE_SETTINGS: "1000103",
    UPLOAD_FILE: "1000104",
    CREATE_SURVEY_BY_JSON: "1000106",
    DELETE_SURVEY: "1000301",
    CLEAR_RECYCLE_BIN: "1000302",
    SUBMIT_RESPONSE: "1001001",
    QUERY_RESPONSES: "1001002",
    QUERY_RESPONSES_REALTIME: "1001003",
    DOWNLOAD_RESPONSES: "1001004",
    GET_FILE_LINKS: "1001005",
    GET_WINNERS: "1001006",
    MODIFY_RESPONSE: "1001007",
    GET_REPORT: "1001101",
    GET_360_REPORT: "1001102",
    CLEAR_RESPONSES: "1001201",
    ADD_PARTICIPANTS: "1002001",
    MODIFY_PARTICIPANTS: "1002002",
    DELETE_PARTICIPANTS: "1002003",
    BIND_ACTIVITY: "1002004",
    QUERY_SURVEY_BINDING: "1002005",
    QUERY_USER_SURVEYS: "1002006",
    ADD_SUB_ACCOUNT: "1003001",
    MODIFY_SUB_ACCOUNT: "1003002",
    DELETE_SUB_ACCOUNT: "1003003",
    RESTORE_SUB_ACCOUNT: "1003004",
    QUERY_SUB_ACCOUNTS: "1003005",
    QUERY_CONTACTS: "1005001",
    ADD_CONTACTS: "1005002",
    MANAGE_CONTACTS: "1005003",
    ADD_ADMIN: "1005004",
    DELETE_ADMIN: "1005005",
    RESTORE_ADMIN: "1005006",
    LIST_DEPARTMENTS: "1005101",
    ADD_DEPARTMENT: "1005102",
    MODIFY_DEPARTMENT: "1005103",
    DELETE_DEPARTMENT: "1005104",
    LIST_TAGS: "1005201",
    ADD_TAG: "1005202",
    MODIFY_TAG: "1005203",
    DELETE_TAG: "1005204",
};
export const DEFAULT_TIMEOUT_MS = 15_000;
/** 耗时操作（下载、报告生成等）使用更长的超时时间 */
export const LONG_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_RETRIES = 2;
export const RETRY_DELAY_MS = 1000;
//# sourceMappingURL=constants.js.map