import { Action } from "wjx-api-sdk";
import type { ActionCatalogEntry } from "./types.js";

const entry = (id: string, command: string, action: string, risk: ActionCatalogEntry["risk"] = "read"): ActionCatalogEntry => ({
  id, command, service: "default", action, input: { type: "object", properties: {} }, risk, identities: ["user", "bot"],
});

export const CATALOG: readonly ActionCatalogEntry[] = Object.freeze([
  entry("survey.get", "survey.get", Action.GET_SURVEY),
  entry("survey.list", "survey.list", Action.LIST_SURVEYS),
  entry("survey.create", "survey.create", Action.CREATE_SURVEY, "write"),
  entry("survey.delete", "survey.delete", Action.DELETE_SURVEY, "high-risk-write"),
  entry("response.submit", "response.submit", Action.SUBMIT_RESPONSE, "write"),
  entry("response.query", "response.query", Action.QUERY_RESPONSES),
].sort((a, b) => a.id.localeCompare(b.id)));

export function findCatalogEntry(query: string): ActionCatalogEntry | undefined {
  return CATALOG.find((item) => item.id === query || item.command === query || item.action === query);
}
