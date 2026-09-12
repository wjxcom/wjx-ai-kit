import { test } from "node:test";
import assert from "node:assert/strict";

import { maskApiKey, maskAuthHeader } from "../dist/lib/mask.js";

test("short API keys are fully masked without overlapping visible fragments", () => {
  for (const key of ["a", "abcd", "abcde", "abcdef", "abcdefg", "abcdefgh"]) {
    assert.equal(maskApiKey(key), "****", `key length ${key.length}`);
  }
  assert.equal(maskApiKey("abcdefghij"), "abcd****ghij");
});

test("short bearer credentials are fully masked without leaking token characters", () => {
  for (const value of ["Bearer a", "Bearer abc", "Bearer abcde", "Bearer abcdef"]) {
    assert.equal(maskAuthHeader(value), "****", value);
  }
  assert.equal(maskAuthHeader("Bearer abcdefghij"), "Bearer abcd****ghij");
});
