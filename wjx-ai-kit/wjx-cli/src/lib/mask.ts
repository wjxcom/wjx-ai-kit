/**
 * Mask sensitive values for display (logs, diagnostics, dry-run previews).
 */

/** Mask an API key: show first 4 + last 4 chars, mask the middle. */
export function maskApiKey(value: string): string {
  if (value.length <= 4) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

/**
 * Mask an Authorization header value (e.g. "Bearer abc...xyz").
 * Preserves the "Bearer " prefix + first 4 key chars, masks middle, keeps last 4.
 */
export function maskAuthHeader(value: string): string {
  if (value.length <= 12) return "****";
  return value.slice(0, 11) + "****" + value.slice(-4);
}
