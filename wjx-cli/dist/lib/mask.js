/**
 * Mask sensitive values for display (logs, diagnostics, dry-run previews).
 */
/** Mask an API key: show first 4 + last 4 chars, mask the middle. */
export function maskApiKey(value) {
    if (value.length <= 4)
        return "****";
    return value.slice(0, 4) + "****" + value.slice(-4);
}
/**
 * Mask an Authorization header value (e.g. "Bearer abc...xyz").
 * Preserves the "Bearer " prefix + first 4 key chars, masks middle, keeps last 4.
 */
export function maskAuthHeader(value) {
    if (value.length <= 12)
        return "****";
    return value.slice(0, 11) + "****" + value.slice(-4);
}
const SENSITIVE_KEY = /(?:api[_-]?key|app[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|passwd|upass|authorization|cookie|credential)/i;
/** Recursively redact credential-like fields before serializing dry-run output. */
export function redactSensitive(value) {
    if (Array.isArray(value))
        return value.map((item) => redactSensitive(item));
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === "object")
                return JSON.stringify(redactSensitive(parsed));
        }
        catch {
            // Ordinary strings are not serialized JSON and remain unchanged.
        }
        return value;
    }
    if (!value || typeof value !== "object")
        return value;
    const output = {};
    for (const [key, item] of Object.entries(value)) {
        output[key] = SENSITIVE_KEY.test(key) ? "****" : redactSensitive(item);
    }
    return output;
}
/** Redact credential-like fields in an already serialized JSON payload. */
export function redactJson(value) {
    try {
        return JSON.stringify(redactSensitive(JSON.parse(value)));
    }
    catch {
        return value;
    }
}
//# sourceMappingURL=mask.js.map