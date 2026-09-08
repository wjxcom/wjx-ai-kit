import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPreviewUrl } from "../dist/index.js";

describe("buildPreviewUrl", () => {
  it("rejects numeric sid values because sid must be a short id", () => {
    assert.throws(
      () => buildPreviewUrl({ sid: "12345" }),
      /sid.*短|sid.*numeric|sid.*short/i,
    );
  });

  it("rejects a sid that is the same value as vid", () => {
    assert.throws(
      () => buildPreviewUrl({ sid: "12345", vid: 12345 }),
      /sid.*vid|short/i,
    );
  });

  it("uses a valid short sid when a fallback vid is also supplied", () => {
    assert.match(
      buildPreviewUrl({ sid: "Y3eWs", vid: 12345 }),
      /\/vm\/Y3eWs\.aspx$/,
    );
  });

  it("requires a verified short sid when vid fallback is disabled", () => {
    assert.throws(
      () => buildPreviewUrl({ vid: 12345, allowVidFallback: false }),
      /verified sid|sid.*unavailable|fallback/i,
    );
  });
});
