import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startFixture } from "./fixtures/http-fixture.mjs";

import {
  resolveProfile,
  saveProfiles,
} from "../dist/lib/profiles.js";
import {
  EnvCredentialProvider,
  getCredentialProvider,
  setCredentialProvider,
} from "../dist/lib/credential-provider.js";

test("environment values override selected and default profile values", () => {
  const profilesPath = join(process.cwd(), "__profile-test.json");
  const document = {
    version: 1,
    defaultProfile: "default",
    profiles: {
      default: { baseUrl: "https://default.example", corpId: "default-corp", credentialRef: "DEFAULT" },
      alt: { baseUrl: "https://alt.example", corpId: "alt-corp", credentialRef: "ALT" },
    },
  };
  writeFileSync(profilesPath, JSON.stringify(document), "utf8");
  try {
    const selected = resolveProfile({ profile: "alt", profilesPath, env: {
      WJX_BASE_URL: "https://env.example",
      WJX_CORP_ID: "env-corp",
    } });
    assert.equal(selected.name, "alt");
    assert.equal(selected.baseUrl, "https://env.example");
    assert.equal(selected.corpId, "env-corp");
    assert.equal(selected.credentialRef, "ALT");

    const fallback = resolveProfile({ profilesPath, env: {} });
    assert.equal(fallback.name, "default");
    assert.equal(fallback.baseUrl, "https://default.example");
    assert.equal(fallback.corpId, "default-corp");
  } finally {
    chmodSync(profilesPath, 0o600);
    // The test file is intentionally isolated and removed after the assertion.
    rmSync(profilesPath, { force: true });
  }
});

test("profile persistence is atomic and user-readable only", () => {
  const dir = join(process.cwd(), "__profile-write-test__");
  mkdirSync(dir, { recursive: true });
  const profilesPath = join(dir, "profiles.json");
  try {
    saveProfiles({ version: 1, defaultProfile: "default", profiles: {
      default: { credentialRef: "DEFAULT" },
    } }, profilesPath);
    const parsed = JSON.parse(readFileSync(profilesPath, "utf8"));
    assert.equal(parsed.version, 1);
    if (process.platform !== "win32") assert.equal(statSync(profilesPath).mode & 0o777, 0o600);
    assert.deepEqual(readdirSync(dir), ["profiles.json"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("credential provider is injectable and the default provider never exposes a raw profile secret", () => {
  const previous = getCredentialProvider();
  try {
    setCredentialProvider({ get: () => ({ apiKey: "injected-key" }) });
    assert.deepEqual(getCredentialProvider().get({ name: "test", credentialRef: "TEST" }, "user"), {
      apiKey: "injected-key",
    });

    const env = { WJX_CREDENTIAL_TEST: "env-key" };
    const provider = new EnvCredentialProvider(env);
    assert.deepEqual(provider.get({ name: "test", credentialRef: "TEST" }, "user"), { apiKey: "env-key" });
  } finally {
    setCredentialProvider(previous);
  }
});

test("selected profile supplies credentials to requests and diagnostics are masked", async () => {
  const fixture = await startFixture({ env: { WJX_API_KEY: "" } });
  const profilesPath = join(fixture.tempDir, "profiles.json");
  writeFileSync(profilesPath, JSON.stringify({
    version: 1,
    defaultProfile: "default",
    profiles: {
      default: { credentialRef: "DEFAULT", corpId: "default-corp" },
      alt: { credentialRef: "ALT", baseUrl: fixture.baseUrl, corpId: "alt-corp" },
    },
  }), "utf8");
  try {
    const result = await fixture.run(["--profile", "alt", "survey", "list"], {
      env: {
        WJX_PROFILES_PATH: profilesPath,
        WJX_CREDENTIAL_ALT: "profile-secret-key",
      },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(fixture.requests().length, 1);
    assert.equal(fixture.requests()[0].headers.authorization, "Bearer profile-secret-key");

    const doctor = await fixture.run(["--profile", "alt", "doctor"], {
      env: {
        WJX_PROFILES_PATH: profilesPath,
        WJX_CREDENTIAL_ALT: "profile-secret-key",
      },
    });
    assert.equal(doctor.exitCode, 0);
    assert.match(doctor.stdout, /alt/);
    assert.match(doctor.stdout, /alt-corp/);
    assert.doesNotMatch(`${doctor.stdout}\n${doctor.stderr}`, /profile-secret-key|Authorization/);
  } finally {
    await fixture.close();
  }
});
