import { defaultPolicyEvaluator } from "../policy.js";
import { processStreams } from "./streams.js";
export function createRuntimeContext(options = {}) {
    return Object.freeze({
        profile: Object.freeze({ ...(options.profile ?? {}) }),
        credentials: options.credentials ? Object.freeze({ ...options.credentials }) : undefined,
        policy: options.policy ?? defaultPolicyEvaluator,
        streams: options.streams ?? processStreams,
        requestOptions: options.requestOptions,
    });
}
//# sourceMappingURL=context.js.map