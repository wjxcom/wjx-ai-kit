import { type WjxCredentials } from "wjx-api-sdk";
import type { RequestPlan } from "./types.js";
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
export declare function buildRequestPlan(input: RequestPlanInput): RequestPlan;
