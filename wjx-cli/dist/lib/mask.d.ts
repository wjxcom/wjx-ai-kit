/**
 * Mask sensitive values for display (logs, diagnostics, dry-run previews).
 */
/** Mask an API key: show first 4 + last 4 chars, mask the middle. */
export declare function maskApiKey(value: string): string;
/**
 * Mask an Authorization header value (e.g. "Bearer abc...xyz").
 * Preserves the "Bearer " prefix + first 4 key chars, masks middle, keeps last 4.
 */
export declare function maskAuthHeader(value: string): string;
