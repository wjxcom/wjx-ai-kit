import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";

import {
  buildSignaturePayload,
  signParams,
  withSignature,
} from "../dist/sign.js";

describe("buildSignaturePayload", () => {
  it("should sort keys alphabetically and concatenate values + appKey", () => {
    const params = {
      appid: "myapp",
      ts: "1700000000",
      action: "1000001",
    };
    // sorted keys: action, appid, ts → values: 1000001, myapp, 1700000000
    const payload = buildSignaturePayload(params, "secret");
    assert.equal(payload, "1000001myapp1700000000secret");
  });

  it("should skip empty string values", () => {
    const params = {
      appid: "myapp",
      ts: "1700000000",
      action: "1000001",
      vid: "",
    };
    const payload = buildSignaturePayload(params, "key");
    assert.equal(payload, "1000001myapp1700000000key");
  });

  it("should skip null values", () => {
    const params = {
      appid: "myapp",
      action: "1",
      nocache: null,
    };
    const payload = buildSignaturePayload(params, "k");
    assert.equal(payload, "1myappk");
  });

  it("should skip undefined values", () => {
    const params = {
      appid: "myapp",
      action: "1",
      encode: undefined,
    };
    const payload = buildSignaturePayload(params, "k");
    assert.equal(payload, "1myappk");
  });

  it("should include non-empty vid in payload", () => {
    const params = {
      appid: "myapp",
      ts: "1700000000",
      action: "1000001",
      vid: "12345",
      get_questions: "0",
      get_items: "0",
    };
    // sorted: action, appid, get_items, get_questions, ts, vid
    const payload = buildSignaturePayload(params, "key");
    assert.equal(payload, "1000001myapp00170000000012345key");
  });

  it("should convert boolean false to string 'false'", () => {
    const params = { publish: false, action: "1" };
    const payload = buildSignaturePayload(params, "k");
    assert.equal(payload, "1falsek");
  });

  it("should convert numeric values to strings", () => {
    const params = { atype: 6, action: "1" };
    const payload = buildSignaturePayload(params, "k");
    assert.equal(payload, "1" + "6" + "k");
  });

  it("should handle single parameter", () => {
    const payload = buildSignaturePayload({ appid: "only" }, "key");
    assert.equal(payload, "onlykey");
  });

  it("should handle empty params object", () => {
    const payload = buildSignaturePayload({}, "key");
    assert.equal(payload, "key");
  });
});

describe("signParams", () => {
  it("should return lowercase 40-char hex SHA1 hash", () => {
    const sign = signParams({ appid: "test", action: "1" }, "key");
    assert.match(sign, /^[0-9a-f]{40}$/);
  });

  it("should compute correct SHA1 for known input", () => {
    const params = { appid: "test", ts: "100", action: "1" };
    const expectedPayload = "1test100key";
    const expected = createHash("sha1")
      .update(expectedPayload, "utf8")
      .digest("hex")
      .toLowerCase();
    assert.equal(signParams(params, "key"), expected);
  });

  it("should produce different signs for different appKeys", () => {
    const params = { appid: "test", ts: "100", action: "1" };
    const sign1 = signParams(params, "key_a");
    const sign2 = signParams(params, "key_b");
    assert.notEqual(sign1, sign2);
  });

  it("should produce different signs for different params", () => {
    const sign1 = signParams({ appid: "test", ts: "100", action: "1" }, "key");
    const sign2 = signParams({ appid: "test", ts: "200", action: "1" }, "key");
    assert.notEqual(sign1, sign2);
  });

  it("should be deterministic", () => {
    const params = { appid: "det", ts: "999", action: "42" };
    const sign1 = signParams(params, "key");
    const sign2 = signParams(params, "key");
    assert.equal(sign1, sign2);
  });

  it("should match the known golden value from spec example", () => {
    // Pre-computed golden value: sorted keys are action, appid, publish(filtered as "false" is non-empty),
    // title, ts → values "1000101" + "test-app" + "false" + "问卷标题" + "1700000000" + appKey "secret-key"
    const params = {
      title: "问卷标题",
      action: "1000101",
      appid: "test-app",
      publish: false,
      ts: "1700000000",
    };
    const sign = signParams(params, "secret-key");
    assert.equal(sign, "b3a551b74307086a5692ab96193190cd05af430c");
  });

  it("should handle Chinese characters in values", () => {
    const params = { title: "满意度调查", action: "1" };
    const sign = signParams(params, "key");
    assert.match(sign, /^[0-9a-f]{40}$/);
  });
});

describe("withSignature", () => {
  it("should return original params plus sign field", () => {
    const params = { appid: "app", action: "1", ts: "100" };
    const result = withSignature(params, "key");

    assert.equal(result.appid, "app");
    assert.equal(result.action, "1");
    assert.equal(result.ts, "100");
    assert.ok("sign" in result, "result should have sign field");
    assert.match(result.sign, /^[0-9a-f]{40}$/);
  });

  it("should not modify the original params object", () => {
    const params = { appid: "app", action: "1" };
    const original = { ...params };
    withSignature(params, "key");
    assert.deepEqual(params, original);
  });

  it("should compute sign correctly", () => {
    const params = { appid: "app", action: "1", ts: "100" };
    const result = withSignature(params, "key");
    const expectedSign = signParams(params, "key");
    assert.equal(result.sign, expectedSign);
  });
});
