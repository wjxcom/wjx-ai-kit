import { getWjxApiUrl } from "wjx-api-sdk";
export function buildRequestPlan(input) {
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
        body: JSON.stringify(input.body),
        ...(input.unresolved && input.unresolved.length > 0
            ? { unresolved: [...input.unresolved] }
            : {}),
    };
}
//# sourceMappingURL=request-plan.js.map