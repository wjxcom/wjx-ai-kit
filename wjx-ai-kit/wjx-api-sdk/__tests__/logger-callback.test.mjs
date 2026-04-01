import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { callWjxApi } from "../dist/index.js";

const credentials = { apiKey: "test-token" };

// ═══════════════════════════════════════════════════════════════════════════════
// Logger callback tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("logger callback", () => {
  it("should call logger.error when API returns result=false", async () => {
    const logs = [];
    const logger = {
      error: (msg) => logs.push({ level: "error", msg }),
      warn: (msg) => logs.push({ level: "warn", msg }),
    };

    const fetchImpl = async () =>
      new Response(
        JSON.stringify({ result: false, errormsg: "invalid vid" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    await callWjxApi(
      { action: "1000001", vid: 999 },
      { credentials, fetchImpl, logger },
    );

    const errorLogs = logs.filter((l) => l.level === "error");
    assert.ok(errorLogs.length > 0, "should have logged an error");
    assert.ok(errorLogs[0].msg.includes("invalid vid"), "error message should contain errormsg");
  });

  it("should call logger.warn on retry", async () => {
    const logs = [];
    const logger = {
      error: (msg) => logs.push({ level: "error", msg }),
      warn: (msg) => logs.push({ level: "warn", msg }),
    };

    let callCount = 0;
    const fetchImpl = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("err", { status: 500, statusText: "Error" });
      }
      return new Response(
        JSON.stringify({ result: true, data: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    await callWjxApi(
      { action: "1001002", vid: 1 },
      { credentials, fetchImpl, logger, maxRetries: 2 },
    );

    const warnLogs = logs.filter((l) => l.level === "warn");
    assert.ok(warnLogs.length > 0, "should have logged a retry warning");
    assert.ok(warnLogs[0].msg.includes("retry"), "warn message should mention retry");
  });

  it("should not call logger when response is successful with result=true", async () => {
    const logs = [];
    const logger = {
      error: (msg) => logs.push({ level: "error", msg }),
      warn: (msg) => logs.push({ level: "warn", msg }),
    };

    const fetchImpl = async () =>
      new Response(
        JSON.stringify({ result: true, data: { surveys: [] } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    await callWjxApi(
      { action: "1000001" },
      { credentials, fetchImpl, logger },
    );

    assert.equal(logs.length, 0, "should not log anything on success");
  });

  it("should work without a logger (no crash)", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({ result: false, errormsg: "some error" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    // Should not throw even without logger
    const result = await callWjxApi(
      { action: "1000001" },
      { credentials, fetchImpl },
    );
    assert.equal(result.result, false);
  });
});
