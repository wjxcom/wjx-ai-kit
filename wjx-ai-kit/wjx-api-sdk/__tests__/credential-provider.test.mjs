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

  it("should return { token } from WJX_TOKEN env var", () => {
    const creds = getWjxCredentials({ WJX_TOKEN: "my-env-token" });
    assert.deepEqual(creds, { token: "my-env-token" });
  });

  it("should throw when WJX_TOKEN is not set and no provider", () => {
    assert.throws(
      () => getWjxCredentials({}),
      /WJX_TOKEN must be set/,
    );
  });

  it("should throw when env is empty object", () => {
    assert.throws(
      () => getWjxCredentials({}),
      /WJX_TOKEN/,
    );
  });
});

describe("setCredentialProvider", () => {
  afterEach(() => {
    // Reset after each test
    setCredentialProvider(undefined);
  });

  it("should use provider credentials when set", () => {
    setCredentialProvider(() => ({ token: "provider-token" }));
    const creds = getWjxCredentials({});
    assert.deepEqual(creds, { token: "provider-token" });
  });

  it("should prefer provider over env var", () => {
    setCredentialProvider(() => ({ token: "provider-token" }));
    const creds = getWjxCredentials({ WJX_TOKEN: "env-token" });
    assert.deepEqual(creds, { token: "provider-token" });
  });

  it("should fall back to env when provider returns undefined", () => {
    setCredentialProvider(() => undefined);
    const creds = getWjxCredentials({ WJX_TOKEN: "env-fallback" });
    assert.deepEqual(creds, { token: "env-fallback" });
  });

  it("should fall back to env when provider returns null", () => {
    setCredentialProvider(() => null);
    const creds = getWjxCredentials({ WJX_TOKEN: "env-fallback" });
    assert.deepEqual(creds, { token: "env-fallback" });
  });

  it("should allow clearing the provider with undefined", () => {
    setCredentialProvider(() => ({ token: "temp" }));
    setCredentialProvider(undefined);
    // Now should fall back to env
    const creds = getWjxCredentials({ WJX_TOKEN: "back-to-env" });
    assert.deepEqual(creds, { token: "back-to-env" });
  });

  it("should throw when both provider returns falsy and no env var", () => {
    setCredentialProvider(() => undefined);
    assert.throws(
      () => getWjxCredentials({}),
      /WJX_TOKEN must be set/,
    );
  });
});
