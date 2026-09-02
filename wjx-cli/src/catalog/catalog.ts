import { Action } from "wjx-api-sdk";
import type { ActionCatalogEntry } from "./types.js";

export type CatalogSource = "api" | "shortcut" | "builtin";
type CatalogEntry = ActionCatalogEntry & { source: CatalogSource };

const apiEntry = (
  id: string,
  action: string,
  risk: ActionCatalogEntry["risk"] = "read",
  service: ActionCatalogEntry["service"] = "default",
): CatalogEntry => ({
  id,
  command: id,
  service,
  action,
  input: { type: "object", properties: {} },
  risk,
  identities: ["user", "bot"],
  source: "api",
});

const shortcutEntry = (id: string, risk: ActionCatalogEntry["risk"] = "read"): CatalogEntry => ({
  id,
  command: id,
  service: "default",
  action: `shortcut:${id}`,
  input: { type: "object", properties: {} },
  risk,
  identities: ["user", "bot"],
  source: "shortcut",
});

const builtinEntry = (id: string, risk: ActionCatalogEntry["risk"] = "read"): CatalogEntry => ({
  id,
  command: id,
  service: "default",
  action: `builtin:${id}`,
  input: { type: "object", properties: {} },
  risk,
  identities: ["user", "bot"],
  source: "builtin",
});

/** Complete public command catalog used by raw API, schema, completion and manifest checks. */
export const CATALOG: readonly CatalogEntry[] = Object.freeze([
  apiEntry("survey.get", Action.GET_SURVEY),
  apiEntry("survey.list", Action.LIST_SURVEYS),
  apiEntry("survey.create", Action.CREATE_SURVEY_BY_JSON, "write"),
  apiEntry("survey.delete", Action.DELETE_SURVEY, "high-risk-write"),
  apiEntry("survey.status", Action.UPDATE_STATUS, "high-risk-write"),
  apiEntry("survey.settings", Action.GET_SETTINGS),
  apiEntry("survey.update-settings", Action.UPDATE_SETTINGS, "high-risk-write"),
  apiEntry("survey.tags", Action.GET_TAGS),
  apiEntry("survey.tag-details", Action.GET_TAG_DETAILS),
  apiEntry("survey.clear-bin", Action.CLEAR_RECYCLE_BIN, "high-risk-write"),
  apiEntry("survey.upload", Action.UPLOAD_FILE, "write"),
  shortcutEntry("survey.export-text"),
  shortcutEntry("survey.url"),
  builtinEntry("survey.jsonl-template"),

  apiEntry("response.count", Action.QUERY_RESPONSES),
  apiEntry("response.query", Action.QUERY_RESPONSES),
  apiEntry("response.realtime", Action.QUERY_RESPONSES_REALTIME),
  apiEntry("response.download", Action.DOWNLOAD_RESPONSES),
  apiEntry("response.submit", Action.SUBMIT_RESPONSE, "write"),
  apiEntry("response.modify", Action.MODIFY_RESPONSE, "high-risk-write"),
  apiEntry("response.clear", Action.CLEAR_RESPONSES, "high-risk-write"),
  apiEntry("response.report", Action.GET_REPORT),
  apiEntry("response.winners", Action.GET_WINNERS),
  shortcutEntry("response.submit-template"),
  apiEntry("response.360-report", Action.GET_360_REPORT),

  apiEntry("contacts.query", Action.QUERY_CONTACTS, "read", "contacts"),
  apiEntry("contacts.add", Action.ADD_CONTACTS, "write", "contacts"),
  apiEntry("contacts.delete", Action.MANAGE_CONTACTS, "high-risk-write", "contacts"),
  apiEntry("department.list", Action.LIST_DEPARTMENTS, "read", "contacts"),
  apiEntry("department.add", Action.ADD_DEPARTMENT, "write", "contacts"),
  apiEntry("department.modify", Action.MODIFY_DEPARTMENT, "write", "contacts"),
  apiEntry("department.delete", Action.DELETE_DEPARTMENT, "high-risk-write", "contacts"),
  apiEntry("admin.add", Action.ADD_ADMIN, "write", "contacts"),
  apiEntry("admin.delete", Action.DELETE_ADMIN, "high-risk-write", "contacts"),
  apiEntry("admin.restore", Action.RESTORE_ADMIN, "write", "contacts"),
  apiEntry("tag.list", Action.LIST_TAGS, "read", "contacts"),
  apiEntry("tag.add", Action.ADD_TAG, "write", "contacts"),
  apiEntry("tag.modify", Action.MODIFY_TAG, "write", "contacts"),
  apiEntry("tag.delete", Action.DELETE_TAG, "high-risk-write", "contacts"),

  apiEntry("user-system.add-participants", Action.ADD_PARTICIPANTS, "write", "user-system"),
  apiEntry("user-system.modify-participants", Action.MODIFY_PARTICIPANTS, "write", "user-system"),
  apiEntry("user-system.delete-participants", Action.DELETE_PARTICIPANTS, "high-risk-write", "user-system"),
  apiEntry("user-system.bind", Action.BIND_ACTIVITY, "write", "user-system"),
  apiEntry("user-system.query-binding", Action.QUERY_SURVEY_BINDING, "read", "user-system"),
  apiEntry("user-system.query-surveys", Action.QUERY_USER_SURVEYS, "read", "user-system"),
  apiEntry("account.list", Action.QUERY_SUB_ACCOUNTS, "read", "subuser"),
  apiEntry("account.add", Action.ADD_SUB_ACCOUNT, "write", "subuser"),
  apiEntry("account.modify", Action.MODIFY_SUB_ACCOUNT, "write", "subuser"),
  apiEntry("account.delete", Action.DELETE_SUB_ACCOUNT, "high-risk-write", "subuser"),
  apiEntry("account.restore", Action.RESTORE_SUB_ACCOUNT, "write", "subuser"),

  builtinEntry("analytics.decode"),
  builtinEntry("analytics.nps"),
  builtinEntry("analytics.csat"),
  builtinEntry("analytics.anomalies"),
  builtinEntry("analytics.compare"),
  builtinEntry("analytics.decode-push"),
  builtinEntry("sso.subaccount-url"),
  builtinEntry("sso.user-system-url"),
  builtinEntry("sso.partner-url"),
  builtinEntry("completion.bash"),
  builtinEntry("completion.zsh"),
  builtinEntry("completion.fish"),
  builtinEntry("completion.install", "write"),
  builtinEntry("reference"),
  builtinEntry("schema"),
  builtinEntry("api", "write"),
  builtinEntry("skill.install", "write"),
  builtinEntry("skill.update", "write"),
  builtinEntry("skill.install-ppt", "write"),
  builtinEntry("skill.update-ppt", "write"),
  builtinEntry("init", "write"),
  builtinEntry("update", "write"),
  builtinEntry("diagnostics.whoami"),
  builtinEntry("diagnostics.doctor"),
].sort((a, b) => a.id.localeCompare(b.id)));

export function findCatalogEntry(query: string): CatalogEntry | undefined {
  return CATALOG.find((item) => item.id === query || item.command === query || item.action === query);
}
