import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startFixture } from "./fixtures/http-fixture.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
test("raw api dry-run uses catalog and does not send network", async () => {
  const result = await new Promise((done) => execFile(process.execPath, [resolve(root, "dist/index.js"), "api", "--service", "default", "--action", "1000002", "--params", '{"page_index":1}', "--dry-run"], { cwd: root, env: { ...process.env, WJX_API_KEY: "key", WJX_CONFIG_PATH: resolve(root, "missing") }, encoding: "utf8" }, (error, stdout, stderr) => done({ code: error?.code ?? 0, stdout, stderr })));
  assert.equal(result.code, 0, result.stderr);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.kind, "dry-run");
  assert.equal(envelope.data.plans[0].action, "1000002");
  assert.equal(result.stderr, "");
});

test("raw api disables retries for catalog write actions", async () => {
  let attempts = 0;
  const fixture = await startFixture({
    env: { WJX_API_KEY: "key" },
    serverFactory: () => createServer((_request, response) => {
      attempts += 1;
      response.destroy();
    }),
  });

  try {
    const result = await fixture.run([
      "api",
      "--service", "default",
      "--action", "1000106",
      "--body", JSON.stringify({ title: "retry guard" }),
      "--yes",
    ]);
    assert.notEqual(result.exitCode, 0);
    assert.equal(attempts, 1);
  } finally {
    await fixture.close();
  }
});

test("raw api routes service-specific catalog actions to their service endpoint", async () => {
  const fixture = await startFixture({ env: { WJX_API_KEY: "key" } });
  try {
    for (const [service, action, path] of [
      ["contacts", "1005001", "/openapi/contacts.aspx"],
      ["subuser", "1003005", "/openapi/subuser.aspx"],
      ["user-system", "1002006", "/openapi/usersystem.aspx"],
    ]) {
      const result = await fixture.run([
        "api",
        "--service", service,
        "--action", action,
        "--body", JSON.stringify({}),
      ]);
      assert.equal(result.exitCode, 0, result.stderr);
      assert.match(fixture.requests().at(-1).path, new RegExp(path.replaceAll(".", "\\.")));
    }
    assert.equal(fixture.requests().length, 3);
  } finally {
    await fixture.close();
  }
});

test("raw api dry-run resolves service-specific endpoint without a profile override", async () => {
  const fixture = await startFixture();
  try {
    const result = await fixture.run([
      "api",
      "--service", "contacts",
      "--action", "1005001",
      "--body", JSON.stringify({ corpid: "corp", uid: "user-1" }),
      "--dry-run",
    ], {
      env: {
        WJX_BASE_URL: "",
        WJX_API_URL: "",
        WJX_CONTACTS_API_URL: `${fixture.baseUrl}/openapi/contacts.aspx`,
      },
    });
    assert.equal(result.exitCode, 0, result.stderr);
    const envelope = JSON.parse(result.stdout);
    assert.match(envelope.data.plans[0].url, /\/openapi\/contacts\.aspx/);
  } finally {
    await fixture.close();
  }
});
