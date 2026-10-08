import type { WjxCredentials } from "wjx-api-sdk";
import type { PolicyEvaluator } from "../policy.js";
import type { RuntimeStreams } from "./streams.js";
import type { RequestOptions } from "wjx-api-sdk";
export interface RuntimeContext {
    readonly profile: Readonly<Record<string, unknown>>;
    readonly credentials?: Readonly<WjxCredentials>;
    readonly policy: PolicyEvaluator;
    readonly streams: RuntimeStreams;
    readonly requestOptions?: Pick<RequestOptions, "retryBudget" | "timeoutMs" | "clientName" | "clientVersion">;
}
export declare function createRuntimeContext(options?: {
    profile?: Record<string, unknown>;
    credentials?: WjxCredentials;
    policy?: PolicyEvaluator;
    streams?: RuntimeStreams;
    requestOptions?: Pick<RequestOptions, "retryBudget" | "timeoutMs" | "clientName" | "clientVersion">;
}): RuntimeContext;
