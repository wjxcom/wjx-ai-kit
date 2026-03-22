import { createHash } from "node:crypto";
import type { SignableRecord } from "./types.js";

type SignableValue = SignableRecord[string];

function normalizeSignableValue(value: SignableValue): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  return String(value);
}

export function buildSignaturePayload(
  params: Record<string, SignableValue>,
  appKey: string,
): string {
  const concatenatedValues = Object.keys(params)
    .filter((key) => key !== "sign")
    .sort()
    .map((key) => normalizeSignableValue(params[key]))
    .filter((value) => value.length > 0)
    .join("");

  return `${concatenatedValues}${appKey}`;
}

export function signParams(
  params: Record<string, SignableValue>,
  appKey: string,
): string {
  return createHash("sha1")
    .update(buildSignaturePayload(params, appKey), "utf8")
    .digest("hex")
    .toLowerCase();
}

export function withSignature<T extends Record<string, SignableValue>>(
  params: T,
  appKey: string,
): T & { sign: string } {
  return {
    ...params,
    sign: signParams(params, appKey),
  };
}
