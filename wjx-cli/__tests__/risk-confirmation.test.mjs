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
  assert.equal(result.stderr.trim(), "", "dry-run should not write diagnostics");
  const envelope = JSON.parse(result.stdout.trim());
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.kind, "dry-run");
  return envelope.data;
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
    assert.equal(fixture.requests().length, 0);
    const preview = parseDryRun(result);
    assert.equal(preview.plans[0].method, "POST");
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

    const write = await fixture.run([
      "survey", "create", "--jsonl",
      '{"qtype":"问卷基础信息","title":"ordinary write"}\n{"qtype":"单选","title":"Q","select":["A","B"]}',
    ]);
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
    ["department", "delete", "--type", "1", "--depts", "[\"dept-1\"]"],
    ["admin", "delete", "--uids", "u1"],
    ["account", "delete", "--subuser", "alice"],
    ["tag", "delete", "--type", "1", "--tags", "[\"tag-1\"]"],
    ["user-system", "delete-participants", "--uids", "[\"u-1\"]", "--sysid", "7"],
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

test("raw API applies catalog risk confirmation before transport", async () => {
  const fixture = await startFixture({ env: { WJX_API_KEY: "risk-test-key" } });
  try {
    const result = await fixture.run([
      "api", "--service", "default", "--action", "survey.delete",
      "--body", JSON.stringify({ vid: 7, username: "alice" }),
    ]);
    assert.notEqual(result.exitCode, 0);
    assert.equal(fixture.requests().length, 0);
    const problem = parseProblem(result);
    assert.equal(problem.code, "CONFIRMATION_REQUIRED");
    assert.equal(problem.command, "survey.delete");
    assert.equal(problem.risk, "high-risk-write");
  } finally {
    await fixture.close();
  }
});

test("raw API preserves upstream error diagnostics", async () => {
  const fixture = await startFixture({
    response: { result: false, errormsg: "拒绝删除", errorcode: 40301, traceid: "trace-raw" },
    env: { WJX_API_KEY: "risk-test-key" },
  });
  try {
    const result = await fixture.run([
      "--yes", "api", "--service", "default", "--action", "survey.delete",
      "--body", JSON.stringify({ vid: 7, username: "alice" }),
    ]);
    assert.equal(result.exitCode, 1);
    assert.equal(fixture.requests().length, 1);
    const problem = parseProblem(result);
    assert.equal(problem.code, "API_ERROR");
    assert.equal(problem.errorcode, 40301);
    assert.equal(problem.traceid, "trace-raw");
  } finally {
    await fixture.close();
  }
});

test("raw API accepts params and body from stdin", async () => {
  const fixture = await startFixture({ env: { WJX_API_KEY: "risk-test-key" } });
  try {
    const result = await fixture.run(
      ["api", "--service", "default", "--action", "survey.list", "--stdin"],
      { input: JSON.stringify({ params: { page_index: 2 }, body: { page_size: 5 } }) },
    );
    assert.equal(result.exitCode, 0);
    const [request] = fixture.requests();
    const payload = JSON.parse(request.body);
    assert.equal(payload.page_index, 2);
    assert.equal(payload.page_size, 5);
    assert.equal(payload.action, "1000002");
  } finally {
    await fixture.close();
  }
});
