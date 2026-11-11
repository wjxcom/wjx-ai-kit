import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import {
  setCredentialProvider,
  getWjxCredentials,
  callWjxApi,
  callWjxUserSystemApi,
  callWjxSubuserApi,
  callWjxContactsApi,
} from "../dist/index.js";

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

  it("routes requests through the provider base URL", async () => {
    setCredentialProvider(() => ({ apiKey: "provider-token", baseUrl: "https://tenant.example" }));
    let seenUrl;
    await callWjxApi(
      { action: "1000001" },
      { fetchImpl: async (url) => {
        seenUrl = String(url);
        return new Response(JSON.stringify({ result: true, data: {} }));
      } },
    );
    assert.match(seenUrl, /^https:\/\/tenant\.example\/openapi\/default\.aspx\?/);
  });

  it("routes every transport endpoint through the provider base URL", async () => {
    setCredentialProvider(() => ({ apiKey: "provider-token", baseUrl: "https://tenant.example" }));
    const seenUrls = [];
    const fetchImpl = async (url) => {
      seenUrls.push(String(url));
      return new Response(JSON.stringify({ result: true, data: {} }));
    };
    await callWjxUserSystemApi({ action: "1002001" }, { fetchImpl });
    await callWjxSubuserApi({ action: "1003001" }, { fetchImpl });
    await callWjxContactsApi({ action: "1005001" }, { fetchImpl });
    assert.match(seenUrls[0], /^https:\/\/tenant\.example\/openapi\/usersystem\.aspx\?/);
    assert.match(seenUrls[1], /^https:\/\/tenant\.example\/openapi\/subuser\.aspx\?/);
    assert.match(seenUrls[2], /^https:\/\/tenant\.example\/openapi\/contacts\.aspx\?/);
  });
});
