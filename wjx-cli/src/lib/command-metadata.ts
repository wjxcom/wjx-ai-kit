import type { Command } from "commander";
import type { RiskLevel } from "./runtime/risk.js";

export interface CommandMetadata {
  path: string;
  risk: RiskLevel;
  identities: Array<"user" | "bot" | "unknown">;
  targetFields: string[];
  /** Agent-facing execution facts are derived here so generated contracts have one source. */
  httpRetryable?: boolean;
  /** Whether the endpoint is safe to replay after a transport failure. */
  idempotent?: boolean;
  consumesQueue?: boolean;
  preRead?: boolean;
  postVerify?: boolean;
  ambiguousTimeout?: "stop-and-report" | "read-after-write";
  maxBatch?: number | null;
}

const USER_TARGETS = ["vid", "jid", "username", "uids", "subuser", "sysid", "type", "depts", "tags"];

const metadata: Record<string, CommandMetadata> = {
  "dsl.query": { path: "dsl.query", risk: "read", identities: ["user", "bot"], targetFields: ["vid"], httpRetryable: true, idempotent: true },
  "dsl.generate": { path: "dsl.generate", risk: "read", identities: ["user", "bot"], targetFields: [] },
  "dsl.create": { path: "dsl.create", risk: "write", identities: ["user", "bot"], targetFields: [] },
  "dsl.update": { path: "dsl.update", risk: "high-risk-write", identities: ["user", "bot"], targetFields: ["vid"], preRead: true, postVerify: true },
  // Catalog IDs retain the historical survey.dsl namespace while command
  // paths use the public dsl.* spelling.
  "survey.dsl.query": { path: "dsl.query", risk: "read", identities: ["user", "bot"], targetFields: ["vid"], httpRetryable: true, idempotent: true },
  "survey.dsl.create": { path: "dsl.create", risk: "write", identities: ["user", "bot"], targetFields: [] },
  "survey.dsl.update": { path: "dsl.update", risk: "high-risk-write", identities: ["user", "bot"], targetFields: ["vid"], preRead: true, postVerify: true },
  "survey.list": { path: "survey.list", risk: "read", identities: ["user", "bot"], targetFields: [], httpRetryable: true, idempotent: true },
  "survey.get": { path: "survey.get", risk: "read", identities: ["user", "bot"], targetFields: ["vid"], httpRetryable: true, idempotent: true },
  "survey.create": { path: "survey.create", risk: "write", identities: ["user", "bot"], targetFields: ["title"], postVerify: true },
  "survey.create-ai-page": { path: "survey.create-ai-page", risk: "write", identities: ["user", "bot"], targetFields: ["title"], postVerify: true },
  "survey.update-ai-page": { path: "survey.update-ai-page", risk: "high-risk-write", identities: ["user"], targetFields: ["vid", "title"], preRead: true, postVerify: true },
  "survey.delete": { path: "survey.delete", risk: "high-risk-write", identities: ["user"], targetFields: ["vid", "username"], preRead: true, postVerify: true },
  "survey.status": { path: "survey.status", risk: "high-risk-write", identities: ["user"], targetFields: ["vid", "state"], preRead: true, postVerify: true },
  "survey.settings": { path: "survey.settings", risk: "read", identities: ["user", "bot"], targetFields: ["vid"], httpRetryable: true, idempotent: true },
  "survey.update-settings": { path: "survey.update-settings", risk: "high-risk-write", identities: ["user"], targetFields: ["vid"], preRead: true, postVerify: true },
  "survey.tags": { path: "survey.tags", risk: "read", identities: ["user", "bot"], targetFields: ["username"], httpRetryable: true, idempotent: true },
  "survey.tag-details": { path: "survey.tag-details", risk: "read", identities: ["user", "bot"], targetFields: ["tag_id"], httpRetryable: true, idempotent: true },
  "survey.clear-bin": { path: "survey.clear-bin", risk: "high-risk-write", identities: ["user"], targetFields: ["username", "vid"], preRead: true, postVerify: true },
  "survey.upload": { path: "survey.upload", risk: "write", identities: ["user", "bot"], targetFields: ["file_name"] },
  "survey.url": { path: "survey.url", risk: "read", identities: ["user", "bot"], targetFields: ["activity", "mode"], httpRetryable: false, idempotent: true },
  "survey.preview-url": { path: "survey.preview-url", risk: "read", identities: ["user", "bot"], targetFields: ["sid", "vid"], httpRetryable: false, idempotent: true },
  "survey.shortlink": {
    path: "survey.shortlink",
    risk: "read",
    identities: ["user", "bot"],
    targetFields: ["url"],
    httpRetryable: false,
    idempotent: true,
    // Repeating is safe, but there is no server-side post-state to read back
    // after an ambiguous response from the public short-link endpoint.
    ambiguousTimeout: "stop-and-report",
  },
  "response.count": { path: "response.count", risk: "read", identities: ["user", "bot"], targetFields: ["vid"], httpRetryable: true, idempotent: true },
  "response.query": { path: "response.query", risk: "read", identities: ["user", "bot"], targetFields: ["vid", "jid"], httpRetryable: true, idempotent: true },
  "response.realtime": { path: "response.realtime", risk: "read", identities: ["user", "bot"], targetFields: ["vid"], httpRetryable: false, idempotent: false },
  "response.download": { path: "response.download", risk: "read", identities: ["user", "bot"], targetFields: ["vid", "taskid"], httpRetryable: false, idempotent: false },
  "response.submit": { path: "response.submit", risk: "write", identities: ["user", "bot"], targetFields: ["vid"], preRead: true },
  "response.modify": {
    path: "response.modify",
    risk: "high-risk-write",
    identities: ["user"],
    targetFields: ["vid", "jid"],
    preRead: true,
    postVerify: true,
  },
  "response.clear": { path: "response.clear", risk: "high-risk-write", identities: ["user"], targetFields: ["username", "vid"], preRead: true, postVerify: true },
  "response.report": { path: "response.report", risk: "read", identities: ["user", "bot"], targetFields: ["vid", "jid"], httpRetryable: false, idempotent: false },
  "response.winners": { path: "response.winners", risk: "read", identities: ["user", "bot"], targetFields: ["vid"], httpRetryable: true, idempotent: true },
  "response.submit-template": { path: "response.submit-template", risk: "read", identities: ["user", "bot"], targetFields: ["vid"], httpRetryable: true, idempotent: true },
  "response.360-report": { path: "response.360-report", risk: "read", identities: ["user", "bot"], targetFields: ["vid", "taskid"], httpRetryable: false, idempotent: false },
  "contacts.query": { path: "contacts.query", risk: "read", identities: ["user", "bot"], targetFields: ["uid", "corpid"], httpRetryable: true, idempotent: true },
  "contacts.add": { path: "contacts.add", risk: "write", identities: ["user"], targetFields: ["corpid"] },
  "contacts.delete": { path: "contacts.delete", risk: "high-risk-write", identities: ["user"], targetFields: ["uids", "corpid"] },
  "department.list": { path: "department.list", risk: "read", identities: ["user", "bot"], targetFields: ["corpid"], httpRetryable: true, idempotent: true },
  "department.add": { path: "department.add", risk: "write", identities: ["user"], targetFields: ["corpid"] },
  "department.modify": { path: "department.modify", risk: "write", identities: ["user"], targetFields: ["corpid"] },
  "department.delete": { path: "department.delete", risk: "high-risk-write", identities: ["user"], targetFields: ["type", "depts", "corpid"] },
  "admin.add": { path: "admin.add", risk: "write", identities: ["user"], targetFields: ["corpid"] },
  "admin.delete": { path: "admin.delete", risk: "high-risk-write", identities: ["user"], targetFields: ["uids", "corpid"] },
  "admin.restore": { path: "admin.restore", risk: "write", identities: ["user"], targetFields: ["uids", "corpid"] },
  "account.list": { path: "account.list", risk: "read", identities: ["user", "bot"], targetFields: ["subuser"], httpRetryable: true, idempotent: true },
  "account.add": { path: "account.add", risk: "write", identities: ["user"], targetFields: ["subuser"] },
  "account.modify": { path: "account.modify", risk: "write", identities: ["user"], targetFields: ["subuser"] },
  "account.delete": { path: "account.delete", risk: "high-risk-write", identities: ["user"], targetFields: ["subuser"] },
  "account.restore": { path: "account.restore", risk: "write", identities: ["user"], targetFields: ["subuser"] },
  "tag.list": { path: "tag.list", risk: "read", identities: ["user", "bot"], targetFields: ["corpid"], httpRetryable: true, idempotent: true },
  "tag.add": { path: "tag.add", risk: "write", identities: ["user"], targetFields: ["corpid"] },
  "tag.modify": { path: "tag.modify", risk: "write", identities: ["user"], targetFields: ["tp_id", "corpid"] },
  "tag.delete": { path: "tag.delete", risk: "high-risk-write", identities: ["user"], targetFields: ["type", "tags", "corpid"] },
  "user-system.add-participants": { path: "user-system.add-participants", risk: "write", identities: ["user"], targetFields: ["sysid"] },
  "user-system.modify-participants": { path: "user-system.modify-participants", risk: "write", identities: ["user"], targetFields: ["sysid"] },
  "user-system.delete-participants": { path: "user-system.delete-participants", risk: "high-risk-write", identities: ["user"], targetFields: ["uids", "sysid"] },
  "user-system.bind": { path: "user-system.bind", risk: "write", identities: ["user"], targetFields: ["vid", "sysid"] },
  "user-system.query-binding": { path: "user-system.query-binding", risk: "read", identities: ["user", "bot"], targetFields: ["vid", "sysid"], httpRetryable: true, idempotent: true },
  "user-system.query-surveys": { path: "user-system.query-surveys", risk: "read", identities: ["user", "bot"], targetFields: ["uid", "sysid"], httpRetryable: true, idempotent: true },
  // Local and composite surfaces are still declared so Catalog, help and
  // policy tooling see the complete public command graph.
  "survey.jsonl-template": { path: "survey.jsonl-template", risk: "read", identities: ["user", "bot"], targetFields: ["type"] },
  "analytics.decode": { path: "analytics.decode", risk: "read", identities: ["user", "bot"], targetFields: [], httpRetryable: false, idempotent: true },
  "analytics.nps": { path: "analytics.nps", risk: "read", identities: ["user", "bot"], targetFields: [], httpRetryable: false, idempotent: true },
  "analytics.csat": { path: "analytics.csat", risk: "read", identities: ["user", "bot"], targetFields: [], httpRetryable: false, idempotent: true },
  "analytics.anomalies": { path: "analytics.anomalies", risk: "read", identities: ["user", "bot"], targetFields: [], httpRetryable: false, idempotent: true },
  "analytics.compare": { path: "analytics.compare", risk: "read", identities: ["user", "bot"], targetFields: [], httpRetryable: false, idempotent: true },
  "analytics.decode-push": { path: "analytics.decode-push", risk: "read", identities: ["user", "bot"], targetFields: [], httpRetryable: false, idempotent: true },
  "sso.subaccount-url": { path: "sso.subaccount-url", risk: "read", identities: ["user", "bot"], targetFields: ["subuser"] },
  "sso.user-system-url": { path: "sso.user-system-url", risk: "read", identities: ["user", "bot"], targetFields: ["sysid", "username"] },
  "sso.partner-url": { path: "sso.partner-url", risk: "read", identities: ["user", "bot"], targetFields: ["username"] },
  "completion.bash": { path: "completion.bash", risk: "read", identities: ["user", "bot"], targetFields: [] },
  "completion.zsh": { path: "completion.zsh", risk: "read", identities: ["user", "bot"], targetFields: [] },
  "completion.fish": { path: "completion.fish", risk: "read", identities: ["user", "bot"], targetFields: [] },
  "completion.install": { path: "completion.install", risk: "write", identities: ["user"], targetFields: [] },
  "reference": { path: "reference", risk: "read", identities: ["user", "bot"], targetFields: [] },
  "schema": { path: "schema", risk: "read", identities: ["user", "bot"], targetFields: [] },
  "api": { path: "api", risk: "write", identities: ["user", "bot"], targetFields: ["service", "action"] },
  "skill.install": { path: "skill.install", risk: "write", identities: ["user"], targetFields: ["targetDir"] },
  "skill.update": { path: "skill.update", risk: "write", identities: ["user"], targetFields: ["targetDir"] },
  "skill.install-ppt": { path: "skill.install-ppt", risk: "write", identities: ["user"], targetFields: ["targetDir"] },
  "skill.update-ppt": { path: "skill.update-ppt", risk: "write", identities: ["user"], targetFields: ["targetDir"] },
  "init": { path: "init", risk: "write", identities: ["user"], targetFields: [] },
  "update": { path: "update", risk: "write", identities: ["user"], targetFields: [] },
  "diagnostics.whoami": { path: "diagnostics.whoami", risk: "read", identities: ["user", "bot"], targetFields: [] },
  "diagnostics.doctor": { path: "diagnostics.doctor", risk: "read", identities: ["user", "bot"], targetFields: [] },
};

export const COMMAND_METADATA: Readonly<Record<string, CommandMetadata>> = Object.freeze(metadata);

export interface AgentExecutionFacts {
  httpRetryable: boolean;
  idempotent: boolean;
  consumesQueue: boolean;
  preRead: boolean;
  postVerify: boolean;
  ambiguousTimeout: "stop-and-report" | "read-after-write";
  maxBatch: number | null;
}

/** Derive Agent facts from command ownership and existing risk annotations. */
export function getAgentExecutionFacts(entry: CommandMetadata): AgentExecutionFacts {
  const queue = entry.path === "response.realtime";
  // Facts are fail-closed when a command has not declared its transport
  // semantics. Risk alone cannot prove replay safety or verification.
  const idempotent = entry.idempotent ?? false;
  return {
    // HTTP retries are opt-in per endpoint. A read risk alone is not enough.
    httpRetryable: entry.httpRetryable ?? false,
    idempotent,
    consumesQueue: entry.consumesQueue ?? queue,
    preRead: entry.preRead ?? false,
    postVerify: entry.postVerify ?? false,
    ambiguousTimeout: entry.ambiguousTimeout ?? (idempotent ? "read-after-write" : "stop-and-report"),
    maxBatch: entry.maxBatch ?? null,
  };
}

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
