import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import { setCredentialProvider, getWjxCredentials } from "../dist/index.js";

// ═══════════════════════════════════════════════════════════════════════════════
// Credential provider tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("getWjxCredentials", () => {
  afterEach(() => {
    // Reset the credential provider after each test
    setCredentialProvider(undefined);
  });

  it("should return { apiKey } from WJX_API_KEY env var", () => {
    const creds = getWjxCredentials({ WJX_API_KEY: "my-env-token" });
    assert.deepEqual(creds, { apiKey: "my-env-token" });
  });

  it("should throw when WJX_API_KEY is not set and no provider", () => {
    assert.throws(
      () => getWjxCredentials({}),
      /WJX_API_KEY must be set/,
    );
  });

  it("should throw when env is empty object", () => {
    assert.throws(
      () => getWjxCredentials({}),
      /WJX_API_KEY/,
    );
  });
});

describe("setCredentialProvider", () => {
  afterEach(() => {
    // Reset after each test
    setCredentialProvider(undefined);
  });

  it("should use provider credentials when set", () => {
    setCredentialProvider(() => ({ apiKey: "provider-token" }));
    const creds = getWjxCredentials({});
    assert.deepEqual(creds, { apiKey: "provider-token" });
  });

  it("should prefer provider over env var", () => {
    setCredentialProvider(() => ({ apiKey: "provider-token" }));
    const creds = getWjxCredentials({ WJX_API_KEY: "env-token" });
    assert.deepEqual(creds, { apiKey: "provider-token" });
  });

  it("should fall back to env when provider returns undefined", () => {
    setCredentialProvider(() => undefined);
    const creds = getWjxCredentials({ WJX_API_KEY: "env-fallback" });
    assert.deepEqual(creds, { apiKey: "env-fallback" });
  });

  it("should fall back to env when provider returns null", () => {
    setCredentialProvider(() => null);
    const creds = getWjxCredentials({ WJX_API_KEY: "env-fallback" });
    assert.deepEqual(creds, { apiKey: "env-fallback" });
  });

  it("should allow clearing the provider with undefined", () => {
    setCredentialProvider(() => ({ apiKey: "temp" }));
    setCredentialProvider(undefined);
    // Now should fall back to env
    const creds = getWjxCredentials({ WJX_API_KEY: "back-to-env" });
    assert.deepEqual(creds, { apiKey: "back-to-env" });
  });

  it("should throw when both provider returns falsy and no env var", () => {
    setCredentialProvider(() => undefined);
    assert.throws(
      () => getWjxCredentials({}),
      /WJX_API_KEY must be set/,
    );
  });
});
