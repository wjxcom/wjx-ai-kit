import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { startFixture } from "./fixtures/http-fixture.mjs";

const execFileAsync = promisify(execFile);
const CLI = fileURLToPath(new URL("../dist/index.js", import.meta.url));

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

test("config persistence follows WJX_CONFIG_PATH changes after module load", async () => {
  const firstPath = join(process.cwd(), `__config-path-first-${randomUUID()}.json`);
  const secondPath = join(process.cwd(), `__config-path-second-${randomUUID()}.json`);
  const previousPath = process.env.WJX_CONFIG_PATH;
  const config = await import(`../dist/lib/config.js?config-path-${randomUUID()}`);
  try {
    process.env.WJX_CONFIG_PATH = firstPath;
    config.saveConfig({ apiKey: "first-key" });
    assert.equal(JSON.parse(readFileSync(firstPath, "utf8")).apiKey, "first-key");

    process.env.WJX_CONFIG_PATH = secondPath;
    config.saveConfig({ apiKey: "second-key" });
    assert.equal(JSON.parse(readFileSync(secondPath, "utf8")).apiKey, "second-key");
    assert.equal(config.loadConfig().apiKey, "second-key");
  } finally {
    if (previousPath === undefined) delete process.env.WJX_CONFIG_PATH;
    else process.env.WJX_CONFIG_PATH = previousPath;
    rmSync(firstPath, { force: true });
    rmSync(secondPath, { force: true });
  }
});

test("loadConfig rejects blank credentials and trims optional routing fields", async () => {
  const configPath = join(process.cwd(), `__config-validation-${randomUUID()}.json`);
  const config = await import(`../dist/lib/config.js?config-validation-${randomUUID()}`);
  try {
    writeFileSync(configPath, JSON.stringify({ apiKey: "   ", baseUrl: "https://invalid.example" }), "utf8");
    assert.equal(config.loadConfig({ WJX_CONFIG_PATH: configPath }), null);

    writeFileSync(configPath, JSON.stringify({ apiKey: " key ", baseUrl: " https://tenant.example/ ", corpId: " corp " }), "utf8");
    assert.deepEqual(config.loadConfig({ WJX_CONFIG_PATH: configPath }), {
      apiKey: "key",
      baseUrl: "https://tenant.example/",
      corpId: "corp",
    });
  } finally {
    rmSync(configPath, { force: true });
  }
});

test("resolveProfile honors the supplied environment for legacy .wjxrc routing", () => {
  const configPath = join(process.cwd(), `__profile-config-${randomUUID()}.json`);
  writeFileSync(configPath, JSON.stringify({
    apiKey: "legacy-key",
    baseUrl: "https://tenant-from-config.example",
    corpId: "config-corp",
  }), "utf8");
  try {
    const resolved = resolveProfile({
      env: { WJX_CONFIG_PATH: configPath },
    });
    assert.equal(resolved.baseUrl, "https://tenant-from-config.example");
    assert.equal(resolved.corpId, "config-corp");
  } finally {
    rmSync(configPath, { force: true });
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

test("credentialRef profiles never fall back to the global API key", () => {
  const provider = new EnvCredentialProvider({ WJX_API_KEY: "global-key" });
  assert.throws(
    () => provider.get({ name: "tenant-a", credentialRef: "TENANT_A" }, "user"),
    /credentialRef|WJX_CREDENTIAL_TENANT_A|未设置/,
  );
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

test("selected profile supplies base URL and corp id to credential-free dry-run previews", async () => {
  const profilesPath = join(process.cwd(), "__profile-dry-run-test.json");
  writeFileSync(profilesPath, JSON.stringify({
    version: 1,
    profiles: {
      alt: { baseUrl: "https://profile.example.test", corpId: "profile-corp" },
    },
  }), "utf8");
  try {
    const env = { ...process.env };
    delete env.WJX_BASE_URL;
    delete env.WJX_API_URL;
    delete env.WJX_API_KEY;
    env.WJX_CONFIG_PATH = join(process.cwd(), "__profile-dry-run-no-config__");
    env.WJX_PROFILES_PATH = profilesPath;

    const list = await execFileAsync(process.execPath, [
      CLI, "--profile", "alt", "--dry-run", "survey", "list",
    ], { cwd: process.cwd(), env, encoding: "utf8" });
    const listEnvelope = JSON.parse(list.stdout);
    assert.equal(listEnvelope.data.plans[0].url, "https://profile.example.test/openapi/default.aspx?action=1000002");

    const contacts = await execFileAsync(process.execPath, [
      CLI, "--profile", "alt", "--dry-run", "contacts", "query", "--uid", "u-1",
    ], { cwd: process.cwd(), env, encoding: "utf8" });
    const contactsEnvelope = JSON.parse(contacts.stdout);
    assert.equal(JSON.parse(contactsEnvelope.data.plans[0].body).corpid, "profile-corp");
  } finally {
    rmSync(profilesPath, { force: true });
  }
});

test("explicit profile routing wins over legacy config defaults", async () => {
  const configFixture = await startFixture({ env: { WJX_API_KEY: "" } });
  const profileFixture = await startFixture({ env: { WJX_API_KEY: "" } });
  const profilesPath = join(configFixture.tempDir, "profiles.json");
  writeFileSync(join(configFixture.tempDir, ".wjxrc"), JSON.stringify({
    apiKey: "legacy-config-key",
    baseUrl: configFixture.baseUrl,
    corpId: "legacy-corp",
  }), "utf8");
  writeFileSync(profilesPath, JSON.stringify({
    version: 1,
    profiles: {
      alt: { baseUrl: profileFixture.baseUrl, credentialRef: "ALT", corpId: "alt-corp" },
    },
  }), "utf8");

  try {
    const result = await configFixture.run(["--profile", "alt", "survey", "list"], {
      env: {
        WJX_BASE_URL: "",
        WJX_API_URL: "",
        WJX_PROFILES_PATH: profilesPath,
        WJX_CREDENTIAL_ALT: "profile-key",
      },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(configFixture.requests().length, 0);
    assert.equal(profileFixture.requests().length, 1);
    assert.equal(profileFixture.requests()[0].headers.authorization, "Bearer profile-key");
  } finally {
    await Promise.all([configFixture.close(), profileFixture.close()]);
  }
});

test("named profiles do not inherit the legacy config API key", async () => {
  const legacyFixture = await startFixture({ env: { WJX_API_KEY: "" } });
  const profileFixture = await startFixture({ env: { WJX_API_KEY: "" } });
  const profilesPath = join(legacyFixture.tempDir, "profiles.json");
  const configPath = join(legacyFixture.tempDir, ".wjxrc");
  writeFileSync(configPath, JSON.stringify({
    apiKey: "legacy-config-key",
    baseUrl: legacyFixture.baseUrl,
  }), "utf8");
  writeFileSync(profilesPath, JSON.stringify({
    version: 1,
    profiles: {
      alt: { baseUrl: profileFixture.baseUrl },
    },
  }), "utf8");

  try {
    const result = await legacyFixture.run(["--profile", "alt", "survey", "list"], {
      env: {
        WJX_CONFIG_PATH: configPath,
        WJX_PROFILES_PATH: profilesPath,
        WJX_API_KEY: "",
        WJX_API_URL: "",
        WJX_BASE_URL: "",
      },
    });
    assert.equal(result.exitCode, 1);
    const problem = JSON.parse(result.stderr);
    assert.equal(problem.ok, false);
    assert.equal(problem.error.code, "AUTH_ERROR");
    assert.equal(legacyFixture.requests().length, 0);
    assert.equal(profileFixture.requests().length, 0);
  } finally {
    await Promise.all([legacyFixture.close(), profileFixture.close()]);
  }
});

test("doctor uses the selected profile credentials instead of legacy config", async () => {
  const configFixture = await startFixture({ env: { WJX_API_KEY: "" } });
  const profileFixture = await startFixture({ env: { WJX_API_KEY: "" } });
  const profilesPath = join(configFixture.tempDir, "profiles.json");
  const configPath = join(configFixture.tempDir, ".wjxrc");
  writeFileSync(configPath, JSON.stringify({
    apiKey: "legacy-config-key",
    baseUrl: configFixture.baseUrl,
    corpId: "legacy-corp",
  }), "utf8");
  writeFileSync(profilesPath, JSON.stringify({
    version: 1,
    profiles: {
      alt: { baseUrl: profileFixture.baseUrl, corpId: "alt-corp", credentialRef: "ALT" },
    },
  }), "utf8");

  try {
    const result = await configFixture.run(["--profile", "alt", "doctor"], {
      env: {
        WJX_CONFIG_PATH: configPath,
        WJX_PROFILES_PATH: profilesPath,
        WJX_CREDENTIAL_ALT: "profile-secret-key",
        WJX_API_KEY: "",
        WJX_API_URL: "",
        WJX_BASE_URL: "",
      },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(configFixture.requests().length, 0);
    assert.equal(profileFixture.requests().length, 1);
    assert.equal(profileFixture.requests()[0].headers.authorization, "Bearer profile-secret-key");
    assert.match(result.stdout, /alt-corp/);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /legacy-config-key|profile-secret-key/);
  } finally {
    await Promise.all([configFixture.close(), profileFixture.close()]);
  }
});

test("explicitly selecting an unknown or blank profile fails before transport", () => {
  const profilesPath = join(process.cwd(), `__profile-selection-${randomUUID()}.json`);
  writeFileSync(profilesPath, JSON.stringify({
    version: 1,
    profiles: { default: {} },
  }), "utf8");
  try {
    assert.throws(
      () => resolveProfile({ profile: "missing", profilesPath, env: {} }),
      /profile "missing" not found/,
    );
    assert.throws(
      () => resolveProfile({ profile: "   ", profilesPath, env: {} }),
      /profile name must not be blank/,
    );
  } finally {
    rmSync(profilesPath, { force: true });
  }
});

test("profile base URL is used by local URL builders", async () => {
  const fixture = await startFixture();
  const profilesPath = join(fixture.tempDir, "profiles.json");
  writeFileSync(profilesPath, JSON.stringify({
    version: 1,
    profiles: { alt: { baseUrl: "https://profile.example.test" } },
  }), "utf8");
  const env = {
    WJX_BASE_URL: "",
    WJX_API_URL: "",
    WJX_CONFIG_PATH: join(fixture.tempDir, "missing.wjxrc"),
    WJX_PROFILES_PATH: profilesPath,
  };
  try {
    const sso = await fixture.run(["--profile", "alt", "sso", "subaccount-url", "--subuser", "u-1"], { env });
    assert.equal(sso.exitCode, 0);
    assert.equal(JSON.parse(sso.stdout).data, "https://profile.example.test/zunxiang/login.aspx?subuser=u-1");

    const survey = await fixture.run(["--profile", "alt", "survey", "url", "--mode", "create"], { env });
    assert.equal(survey.exitCode, 0);
    assert.equal(JSON.parse(survey.stdout).data.url, "https://profile.example.test/newwjx/mysojump/createblankNew.aspx");
  } finally {
    await fixture.close();
  }
});
