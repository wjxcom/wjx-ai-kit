import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toolResult, toolError } from "../dist/helpers.js";

describe("toolResult", () => {
  it("should serialize data as JSON text content", () => {
    const result = toolResult({ key: "value" }, false);
    assert.equal(result.isError, false);
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, "text");
    assert.deepEqual(JSON.parse(result.content[0].text), { key: "value" });
  });

  it("should set isError flag when true", () => {
    const result = toolResult({ error: true }, true);
    assert.equal(result.isError, true);
  });

  it("should handle null data", () => {
    const result = toolResult(null, false);
    assert.equal(result.content[0].text, "null");
  });

  it("should handle undefined data via fallback", () => {
    const result = toolResult(undefined, false);
    // JSON.stringify(undefined) returns undefined (not a string),
    // so the ?? fallback to String(data) kicks in
    assert.equal(result.content[0].text, "undefined");
  });

  it("should handle numeric data", () => {
    const result = toolResult(42, false);
    assert.equal(result.content[0].text, "42");
  });

  it("should handle string data", () => {
    const result = toolResult("hello", false);
    assert.equal(result.content[0].text, '"hello"');
  });

  it("should handle circular references gracefully", () => {
    const obj = {};
    obj.self = obj;
    const result = toolResult(obj, false);
    // Should fallback to String(data)
    assert.equal(typeof result.content[0].text, "string");
    assert.equal(result.isError, false);
  });

  it("should produce compact JSON (no pretty-printing)", () => {
    const result = toolResult({ a: 1, b: [2, 3] }, false);
    assert.equal(result.content[0].text, '{"a":1,"b":[2,3]}');
  });
});

describe("toolError", () => {
  it("should format Error instances", () => {
    const result = toolError(new Error("test error"));
    assert.equal(result.isError, true);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.result, false);
    assert.equal(parsed.errormsg, "test error");
  });

  it("should format string errors", () => {
    const result = toolError("string error");
    assert.equal(result.isError, true);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.errormsg, "string error");
  });

  it("should format number errors", () => {
    const result = toolError(404);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.errormsg, "404");
  });

  it("should handle null error", () => {
    const result = toolError(null);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.errormsg, "null");
  });
});
