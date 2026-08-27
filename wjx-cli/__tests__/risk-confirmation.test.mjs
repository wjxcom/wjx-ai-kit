import { test } from "node:test";
import assert from "node:assert/strict";
import { startFixture } from "./fixtures/http-fixture.mjs";

const env = { WJX_API_KEY: "risk-test-key" };

function parseProblem(result) {
  assert.notEqual(result.stderr.trim(), "", "expected structured stderr output");
  const envelope = JSON.parse(result.stderr.trim());
  assert.equal(envelope.ok, false);
  assert.ok(envelope.error && typeof envelope.error === "object");
  return { ...envelope.error, exitCode: envelope.exitCode };
}

function parseDryRun(result) {
  assert.notEqual(result.stderr.trim(), "", "expected dry-run preview");
  return JSON.parse(result.stderr.trim());
}

test("high-risk commands reject non-interactive execution without --yes before any request", async () => {
  const fixture = await startFixture({ env });
  try {
    const result = await fixture.run([
      "survey", "delete", "--vid", "7", "--username", "alice",
    ]);

    assert.notEqual(result.exitCode, 0);
    assert.equal(fixture.requests().length, 0);
    const problem = parseProblem(result);
    assert.match(`${problem.code} ${problem.type} ${problem.message}`, /confirmation_required/i);
    assert.equal(problem.command, "survey.delete");
    assert.equal(problem.risk, "high-risk-write");
    assert.match(String(problem.target), /7|alice/);
    assert.equal(problem.confirmation_source, "missing");
  } finally {
    await fixture.close();
  }
});

test("--yes permits a high-risk command to reach the transport", async () => {
  const fixture = await startFixture({ env });
  try {
    const result = await fixture.run([
      "--yes", "survey", "delete", "--vid", "7", "--username", "alice",
    ]);

    assert.equal(result.exitCode, 0);
    assert.equal(fixture.requests().length, 1);
    assert.match(result.stdout, /result|data/);
  } finally {
    await fixture.close();
  }
});

test("dry-run takes precedence over high-risk confirmation and remains network-free", async () => {
  const fixture = await startFixture({ env });
  try {
    const result = await fixture.run([
      "--dry-run", "survey", "delete", "--vid", "7", "--username", "alice",
    ]);

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
    assert.equal(fixture.requests().length, 0);
    const preview = parseDryRun(result);
    assert.equal(preview.dry_run, true);
    assert.equal(preview.request.method, "POST");
  } finally {
    await fixture.close();
  }
});

test("read and ordinary write commands are not blocked by the high-risk gate", async () => {
  const fixture = await startFixture({ env });
  try {
    const read = await fixture.run(["survey", "list"]);
    assert.equal(read.exitCode, 0);
    assert.equal(fixture.requests().length, 1);

    const write = await fixture.run(["survey", "create", "--title", "ordinary write"]);
    assert.equal(write.exitCode, 0);
    assert.equal(fixture.requests().length, 2);
  } finally {
    await fixture.close();
  }
});

test("all declared destructive shortcuts require confirmation", async () => {
  const cases = [
    ["survey", "clear-bin", "--username", "alice"],
    ["survey", "status", "--vid", "7", "--state", "1"],
    ["survey", "update-settings", "--vid", "7"],
    ["response", "modify", "--vid", "7", "--jid", "8", "--answers", "ok"],
    ["response", "clear", "--username", "alice", "--vid", "7"],
    ["contacts", "delete", "--uids", "u1"],
    ["department", "delete", "--type", "1", "--depts", "[]"],
    ["admin", "delete", "--uids", "u1"],
    ["account", "delete", "--subuser", "alice"],
    ["tag", "delete", "--type", "1", "--tags", "[]"],
    ["user-system", "delete-participants", "--uids", "[]", "--sysid", "7"],
  ];

  const fixture = await startFixture({ env });
  try {
    for (const args of cases) {
      const result = await fixture.run(args);
      assert.notEqual(result.exitCode, 0, args.join(" "));
      assert.equal(fixture.requests().length, 0, args.join(" "));
      const problem = parseProblem(result);
      assert.match(`${problem.code} ${problem.type} ${problem.message}`, /confirmation_required/i, args.join(" "));
      assert.equal(problem.risk, "high-risk-write", args.join(" "));
    }
  } finally {
    await fixture.close();
  }
});
