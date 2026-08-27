import type { Command } from "commander";
import type { RiskLevel } from "./runtime/risk.js";

export interface CommandMetadata {
  path: string;
  risk: RiskLevel;
  identities: Array<"user" | "bot" | "unknown">;
  targetFields: string[];
}

const USER_TARGETS = ["vid", "jid", "username", "uids", "subuser", "sysid", "type", "depts", "tags"];

const metadata: Record<string, CommandMetadata> = {
  "survey.list": { path: "survey.list", risk: "read", identities: ["user", "bot"], targetFields: [] },
  "survey.get": { path: "survey.get", risk: "read", identities: ["user", "bot"], targetFields: ["vid"] },
  "survey.create": { path: "survey.create", risk: "write", identities: ["user", "bot"], targetFields: ["title"] },
  "survey.create-by-text": { path: "survey.create-by-text", risk: "write", identities: ["user", "bot"], targetFields: ["title"] },
  "survey.create-by-json": { path: "survey.create-by-json", risk: "write", identities: ["user", "bot"], targetFields: ["title"] },
  "survey.delete": { path: "survey.delete", risk: "high-risk-write", identities: ["user"], targetFields: ["vid", "username"] },
  "survey.status": { path: "survey.status", risk: "high-risk-write", identities: ["user"], targetFields: ["vid", "state"] },
  "survey.settings": { path: "survey.settings", risk: "read", identities: ["user", "bot"], targetFields: ["vid"] },
  "survey.update-settings": { path: "survey.update-settings", risk: "high-risk-write", identities: ["user"], targetFields: ["vid"] },
  "survey.tags": { path: "survey.tags", risk: "read", identities: ["user", "bot"], targetFields: ["username"] },
  "survey.tag-details": { path: "survey.tag-details", risk: "read", identities: ["user", "bot"], targetFields: ["tag_id"] },
  "survey.clear-bin": { path: "survey.clear-bin", risk: "high-risk-write", identities: ["user"], targetFields: ["username", "vid"] },
  "survey.upload": { path: "survey.upload", risk: "write", identities: ["user", "bot"], targetFields: ["file_name"] },
  "survey.url": { path: "survey.url", risk: "read", identities: ["user", "bot"], targetFields: ["activity", "mode"] },
  "response.query": { path: "response.query", risk: "read", identities: ["user", "bot"], targetFields: ["vid", "jid"] },
  "response.realtime": { path: "response.realtime", risk: "read", identities: ["user", "bot"], targetFields: ["vid"] },
  "response.download": { path: "response.download", risk: "read", identities: ["user", "bot"], targetFields: ["vid", "taskid"] },
  "response.submit": { path: "response.submit", risk: "write", identities: ["user", "bot"], targetFields: ["vid"] },
  "response.modify": { path: "response.modify", risk: "high-risk-write", identities: ["user"], targetFields: ["vid", "jid"] },
  "response.clear": { path: "response.clear", risk: "high-risk-write", identities: ["user"], targetFields: ["username", "vid"] },
  "response.report": { path: "response.report", risk: "read", identities: ["user", "bot"], targetFields: ["vid", "jid"] },
  "response.winners": { path: "response.winners", risk: "read", identities: ["user", "bot"], targetFields: ["vid"] },
  "response.submit-template": { path: "response.submit-template", risk: "read", identities: ["user", "bot"], targetFields: ["vid"] },
  "response.360-report": { path: "response.360-report", risk: "read", identities: ["user", "bot"], targetFields: ["vid", "taskid"] },
  "contacts.query": { path: "contacts.query", risk: "read", identities: ["user", "bot"], targetFields: ["uid", "corpid"] },
  "contacts.add": { path: "contacts.add", risk: "write", identities: ["user"], targetFields: ["corpid"] },
  "contacts.delete": { path: "contacts.delete", risk: "high-risk-write", identities: ["user"], targetFields: ["uids", "corpid"] },
  "department.list": { path: "department.list", risk: "read", identities: ["user", "bot"], targetFields: ["corpid"] },
  "department.add": { path: "department.add", risk: "write", identities: ["user"], targetFields: ["corpid"] },
  "department.modify": { path: "department.modify", risk: "write", identities: ["user"], targetFields: ["corpid"] },
  "department.delete": { path: "department.delete", risk: "high-risk-write", identities: ["user"], targetFields: ["type", "depts", "corpid"] },
  "admin.add": { path: "admin.add", risk: "write", identities: ["user"], targetFields: ["corpid"] },
  "admin.delete": { path: "admin.delete", risk: "high-risk-write", identities: ["user"], targetFields: ["uids", "corpid"] },
  "admin.restore": { path: "admin.restore", risk: "write", identities: ["user"], targetFields: ["uids", "corpid"] },
  "account.list": { path: "account.list", risk: "read", identities: ["user", "bot"], targetFields: ["subuser"] },
  "account.add": { path: "account.add", risk: "write", identities: ["user"], targetFields: ["subuser"] },
  "account.modify": { path: "account.modify", risk: "write", identities: ["user"], targetFields: ["subuser"] },
  "account.delete": { path: "account.delete", risk: "high-risk-write", identities: ["user"], targetFields: ["subuser"] },
  "account.restore": { path: "account.restore", risk: "write", identities: ["user"], targetFields: ["subuser"] },
  "tag.list": { path: "tag.list", risk: "read", identities: ["user", "bot"], targetFields: ["corpid"] },
  "tag.add": { path: "tag.add", risk: "write", identities: ["user"], targetFields: ["corpid"] },
  "tag.modify": { path: "tag.modify", risk: "write", identities: ["user"], targetFields: ["tp_id", "corpid"] },
  "tag.delete": { path: "tag.delete", risk: "high-risk-write", identities: ["user"], targetFields: ["type", "tags", "corpid"] },
  "user-system.add-participants": { path: "user-system.add-participants", risk: "write", identities: ["user"], targetFields: ["sysid"] },
  "user-system.modify-participants": { path: "user-system.modify-participants", risk: "write", identities: ["user"], targetFields: ["sysid"] },
  "user-system.delete-participants": { path: "user-system.delete-participants", risk: "high-risk-write", identities: ["user"], targetFields: ["uids", "sysid"] },
  "user-system.bind": { path: "user-system.bind", risk: "write", identities: ["user"], targetFields: ["vid", "sysid"] },
  "user-system.query-binding": { path: "user-system.query-binding", risk: "read", identities: ["user", "bot"], targetFields: ["vid", "sysid"] },
  "user-system.query-surveys": { path: "user-system.query-surveys", risk: "read", identities: ["user", "bot"], targetFields: ["uid", "sysid"] },
};

export const COMMAND_METADATA: Readonly<Record<string, CommandMetadata>> = Object.freeze(metadata);

export function getCommandMetadata(path: string): CommandMetadata {
  return COMMAND_METADATA[path] ?? {
    path,
    // Unregistered commands are conservatively treated as ordinary writes.
    risk: "write",
    identities: ["unknown"],
    targetFields: USER_TARGETS,
  };
}

export function listHighRiskCommands(): string[] {
  return Object.values(COMMAND_METADATA)
    .filter((entry) => entry.risk === "high-risk-write")
    .map((entry) => entry.path)
    .sort();
}

export function getCommandPath(command: Command): string {
  const names: string[] = [];
  let current: Command | undefined = command;
  while (current) {
    names.unshift(current.name());
    current = current.parent ?? undefined;
  }
  return names.length > 1 ? names.slice(1).join(".") : names[0] ?? "";
}
