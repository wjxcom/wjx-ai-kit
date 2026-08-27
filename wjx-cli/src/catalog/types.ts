import type { RiskLevel } from "../lib/runtime/risk.js";

export interface ActionCatalogEntry {
  id: string;
  command?: string;
  service: "default" | "user-system" | "subuser" | "contacts";
  action: string;
  input: Record<string, unknown>;
  response?: Record<string, unknown>;
  risk: RiskLevel;
  identities: Array<"user" | "bot" | "unknown">;
  pagination?: Record<string, unknown>;
}
