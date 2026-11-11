import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveHttpCredentials } from "../dist/transports/http.js";

test("HTTP transport separates MCP auth from upstream WJX credentials", () => {
  assert.deepEqual(
    resolveHttpCredentials({ bearerToken: "transport-token", tenantMode: false, upstreamApiKey: "wjx-key" }),
    { apiKey: "wjx-key" },
  );
  assert.deepEqual(
    resolveHttpCredentials({
      bearerToken: "transport-token",
      requestApiKey: "tenant-key",
      tenantMode: true,
      upstreamApiKey: "global-key",
    }),
    { apiKey: "tenant-key" },
  );
  assert.equal(
    resolveHttpCredentials({
      bearerToken: "transport-token",
      tenantMode: true,
      upstreamApiKey: "global-key",
    }),
    undefined,
    "tenant mode must not fall back to a process-wide key",
  );
  assert.deepEqual(
    resolveHttpCredentials({
      bearerToken: "legacy-key",
      tenantMode: true,
      legacyBearerApiKey: true,
    }),
    { apiKey: "legacy-key" },
  );
});
