import { createHash } from "node:crypto";

/**
 * Build SSO signature by concatenating values in order (not sorted).
 * sign = sha1(appid + appkey + param1 + param2 + ... + ts)
 */
export function buildSsoSignature(orderedValues: string[]): string {
  const payload = orderedValues.join("");
  return createHash("sha1").update(payload, "utf8").digest("hex").toLowerCase();
}
