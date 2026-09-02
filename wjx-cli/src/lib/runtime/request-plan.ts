import { getWjxApiUrl, type WjxCredentials } from "wjx-api-sdk";
import type { RequestPlan } from "./types.js";
import { redactJson } from "../mask.js";

export interface RequestPlanInput {
  service?: string;
  action: string | number;
  method?: "POST";
  url?: string;
  apiKey?: string;
  credentials?: WjxCredentials;
  body: Record<string, unknown>;
  unresolved?: string[];
}

export function buildRequestPlan(input: RequestPlanInput): RequestPlan {
  const action = String(input.action);
  const baseUrl = input.url ?? getWjxApiUrl();
  const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}action=${encodeURIComponent(action)}`;
  const apiKey = input.apiKey ?? input.credentials?.apiKey;
  const headers = {
    "Content-Type": "application/json",
    Authorization: apiKey ? "Bearer ****" : "Bearer ****",
  };
  return {
    service: input.service ?? "default",
    action,
    method: "POST",
    url,
    headers,
    body: redactJson(JSON.stringify(input.body)),
    ...(input.unresolved && input.unresolved.length > 0
      ? { unresolved: [...input.unresolved] }
      : {}),
  };
}
