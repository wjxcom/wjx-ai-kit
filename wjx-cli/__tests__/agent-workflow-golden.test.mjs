import assert from "node:assert/strict";
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { test } from "node:test";

import { startFixture } from "./fixtures/http-fixture.mjs";

const API_KEY = "golden-fixture-key";

function actionOf(request) {
  try {
    return String(JSON.parse(request.body).action ?? "");
  } catch {
    return "";
  }
}

function bodyOf(request) {
  return JSON.parse(request.body);
}

function success(result, label) {
  assert.equal(result.exitCode, 0, `${label}: ${result.stderr}`);
  assert.equal(result.stderr.trim(), "", `${label}: unexpected stderr`);
  const envelope = JSON.parse(result.stdout.trim());
  assert.equal(envelope.ok, true, `${label}: ${result.stdout}`);
  return envelope.data;
}

function problem(result, label) {
  assert.notEqual(result.exitCode, 0, `${label}: expected a failure`);
  assert.notEqual(result.stderr.trim(), "", `${label}: expected structured stderr`);
  const envelope = JSON.parse(result.stderr.trim());
  assert.equal(envelope.ok, false, `${label}: ${result.stderr}`);
  return envelope.error;
}

/**
 * Route responses by the action query parameter while retaining the fixture's
 * request recorder. The API action is in the URL, so the wrapper does not
 * consume the request stream before the recorder sees it.
 */
async function startRoutedFixture(route, options = {}) {
  const response = { result: true, data: {} };
  let requestNumber = 0;
  const fixture = await startFixture({
    ...options,
    response,
    env: { WJX_API_KEY: API_KEY, ...(options.env ?? {}) },
    serverFactory: (fallback) => createServer(async (request, responseStream) => {
      const action = new URL(request.url ?? "/", "http://fixture").searchParams.get("action") ?? "";
      const origin = `http://${String(request.headers.host ?? "127.0.0.1")}`;
      const routed = await route({ action, origin, requestNumber: ++requestNumber });
      for (const key of Object.keys(response)) delete response[key];
      Object.assign(response, routed ?? { result: true, data: {} });
      await fallback(request, responseStream);
    }),
  });
  return fixture;
}

function verifiedSurveyResponse(
  status = 1,
  origin = "http://127.0.0.1",
  questionType = { q_type: 3, q_subtype: 3 },
) {
  return {
    result: true,
    data: {
      vid: 700001,
      sid: "goldenSid",
      title: "Golden Survey",
      status,
      verify_status: 1,
      questions: [{ q_index: 1, ...questionType, q_title: "满意度" }],
      activity_domain: origin,
      pc_path: "/vm/goldenSid.aspx",
      edit_url: "/newwjx/design/editquestionnaire.aspx?activity=700001",
    },
  };
}

test("golden CLI create workflow covers survey, vote, exam, and form atypes", async () => {
  const cases = [
    { atype: 1, qtype: "单选", questionType: { q_type: 3, q_subtype: 3 } },
    { atype: 3, qtype: "投票单选", questionType: { q_type: 3, q_subtype: 3 } },
    { atype: 6, qtype: "考试单选", questionType: { q_type: 3, q_subtype: 303 } },
    { atype: 7, qtype: "单项填空", questionType: { q_type: 5, q_subtype: 5 } },
  ];
  let createCount = 0;
  const fixture = await startRoutedFixture(({ action, origin }) => {
    if (action === "1000106") {
      createCount += 1;
      return { result: true, data: { vid: 700001 } };
    }
    if (action === "1000001") {
      const entry = cases[Math.max(0, createCount - 1)] ?? cases[0];
      return verifiedSurveyResponse(1, origin, entry.questionType);
    }
    return { result: true, data: {} };
  });
  try {
    for (const [index, entry] of cases.entries()) {
      const jsonl = [
        JSON.stringify({ qtype: "问卷基础信息", title: "Golden Survey" }),
        JSON.stringify({ qtype: entry.qtype, title: `题目 ${index + 1}`, select: ["A", "B"] }),
      ].join("\n");
      const result = await fixture.run([
        "--yes", "survey", "create", "--type", String(entry.atype), "--jsonl", jsonl,
      ]);
      const data = success(result, `create atype ${entry.atype}`);
      assert.equal(data.vid, 700001);
      // The recorder proves the post-write read happened; the explicit get
      // below exercises the returned title/status/link fields directly.
      const readBack = success(await fixture.run(["survey", "get", "--vid", "700001"]), `read back atype ${entry.atype}`);
      assert.equal(readBack.title, "Golden Survey");
      assert.equal(readBack.status, 1);
      assert.equal(readBack.sid, "goldenSid");
      assert.equal(readBack.pc_path, "/vm/goldenSid.aspx");

      const createRequest = fixture.requests().map(bodyOf).find((body) => body.action === "1000106" && body.atype === entry.atype);
      assert.ok(createRequest, `create request for atype ${entry.atype} was recorded`);
      assert.equal(createRequest.atype, entry.atype);
      const metadata = JSON.parse(createRequest.surveydatajson.split(/\r?\n/)[0]);
      assert.equal(metadata.atype, entry.atype, "atype must be present in JSONL metadata as well as the top-level request");
      assert.equal(createRequest.publish, true, "ordinary question workflows publish by default");
    }
  } finally {
    await fixture.close();
  }
});

test("framework-only create defaults to draft and publish requires explicit confirmation", async () => {
  let published = false;
  const fixture = await startRoutedFixture(({ action, origin }) => {
    if (action === "1000106") return { result: true, data: { vid: 700001 } };
    if (action === "1000001") return verifiedSurveyResponse(published ? 1 : 0, origin);
    if (action === "1000102") {
      published = true;
      return { result: true, data: {} };
    }
    return { result: true, data: {} };
  });
  const frameworkJsonl = [
    JSON.stringify({ qtype: "问卷基础信息", title: "Golden Survey" }),
    JSON.stringify({ qtype: "折叠栏目", title: "后续编辑区" }),
  ].join("\n");
  try {
    const draft = await fixture.run(["survey", "create", "--jsonl", frameworkJsonl]);
    const draftData = success(draft, "framework draft");
    assert.equal(draftData.vid, 700001);
    const draftReadBack = success(await fixture.run(["survey", "get", "--vid", "700001"]), "framework draft read back");
    assert.equal(draftReadBack.status, 0);
    const createBody = bodyOf(fixture.requests().find((request) => actionOf(request) === "1000106"));
    assert.equal(createBody.publish, false);

    const blocked = await fixture.run(["survey", "status", "--vid", "700001", "--state", "1"]);
    const confirmation = problem(blocked, "publish without confirmation");
    assert.equal(confirmation.code, "CONFIRMATION_REQUIRED");
    assert.equal(fixture.requests().filter((request) => actionOf(request) === "1000102").length, 0);

    const published = await fixture.run(["--yes", "survey", "status", "--vid", "700001", "--state", "1"]);
    const publishedData = success(published, "publish with confirmation");
    success(published, "publish with confirmation");
    const publishedReadBack = success(await fixture.run(["survey", "get", "--vid", "700001"]), "published read back");
    assert.equal(publishedReadBack.status, 1);
    assert.ok(fixture.requests().some((request) => actionOf(request) === "1000102"));
  } finally {
    await fixture.close();
  }
});

test("survey status stops before writing when the pre-read identity differs", async () => {
  let statusWrites = 0;
  const fixture = await startRoutedFixture(({ action }) => {
    if (action === "1000001") return { result: true, data: { vid: 700002, status: 1 } };
    if (action === "1000102") {
      statusWrites += 1;
      return { result: true, data: { saved: true } };
    }
    return { result: true, data: {} };
  });
  try {
    const result = await fixture.run(["--yes", "survey", "status", "--vid", "700001", "--state", "2"]);
    const error = problem(result, "status mismatched pre-read identity");
    assert.equal(error.code, "API_ERROR");
    assert.match(error.message, /身份|编号|停止/);
    assert.equal(statusWrites, 0, "status must not be sent after an identity mismatch");
    assert.deepEqual(fixture.requests().map((request) => actionOf(request)), ["1000001"]);
  } finally {
    await fixture.close();
  }
});

test("local JSONL and analytics validation performs zero network requests", async () => {
  const fixture = await startRoutedFixture(() => ({ result: true, data: {} }));
  try {
    const invalidJsonls = [
      ["english qtype", [
        { qtype: "问卷基础信息", title: "Golden Survey" },
        { qtype: "single choice", title: "Q", select: ["A", "B"] },
      ]],
      ["duplicate metadata", [
        { qtype: "问卷基础信息", title: "Golden Survey" },
        { qtype: "问卷基础信息", title: "第二标题" },
        { qtype: "单选", title: "Q", select: ["A", "B"] },
      ]],
      ["zero questions", [{ qtype: "问卷基础信息", title: "Golden Survey" }]],
      ["invalid NPS", [
        { qtype: "问卷基础信息", title: "Golden Survey" },
        { qtype: "NPS量表", title: "推荐度", select: ["0", "1"] },
      ]],
    ];
    for (const [label, rows] of invalidJsonls) {
      const result = await fixture.run(["survey", "create", "--jsonl", rows.map(JSON.stringify).join("\n")]);
      const error = problem(result, label);
      assert.equal(error.type, "validation", label);
      assert.equal(fixture.requests().length, 0, `${label} must fail before transport`);
    }

    const atype8 = await fixture.run([
      "survey", "create", "--type", "8", "--jsonl",
      JSON.stringify({ qtype: "问卷基础信息", title: "Golden Survey" }) + "\n" + JSON.stringify({ qtype: "单选", title: "Q", select: ["A", "B"] }),
    ]);
    assert.equal(problem(atype8, "atype 8" ).type, "validation");
    assert.equal(fixture.requests().length, 0);

    const hugePath = `${fixture.tempDir}/oversized.jsonl`;
    await writeFile(hugePath, `${JSON.stringify({ qtype: "问卷基础信息", title: "Golden Survey" })}\n${JSON.stringify({ qtype: "单项填空", title: "Q", value: "x".repeat(1_000_100) })}`, "utf8");
    const oversized = await fixture.run(["survey", "create", "--file", hugePath]);
    assert.equal(problem(oversized, "oversized JSONL").type, "validation");
    assert.equal(fixture.requests().length, 0);

    const invalidCsat = await fixture.run(["analytics", "csat", "--scores", "[6]"]);
    assert.equal(problem(invalidCsat, "invalid CSAT scale").type, "validation");
    assert.equal(fixture.requests().length, 0, "local analytics must never call the API");
  } finally {
    await fixture.close();
  }
});

test("response pagination, queue consumption, asynchronous polling, and clear confirmation are explicit", async () => {
  const counters = new Map();
  const fixture = await startRoutedFixture(({ action }) => {
    const count = (counters.set(action, (counters.get(action) ?? 0) + 1), counters.get(action));
    if (action === "1001002") {
      if (count <= 2) return { result: true, data: { total_count: 42, join_times: 50, page_index: 2, page_size: 2, responses: [{ jid: 11 }, { jid: 12 }] } };
      return { result: true, data: { page_index: 1, page_size: 2, responses: [{ jid: 13 }] } };
    }
    if (action === "1001003") {
      return { result: true, data: { responses: count === 1 ? [{ jid: 21 }] : [] } };
    }
    if (action === "1001004") {
      return count === 1
        ? { result: true, data: { status: 0, taskid: "download-task" } }
        : { result: true, data: { status: 1, taskid: "download-task", url: "https://files.example/download.csv" } };
    }
    if (action === "1001101") return { result: true, data: { status: 0, taskid: "report-task" } };
    if (action === "1001102") {
      return count === 1
        ? { result: true, data: { status: 0, taskid: "360-task" } }
        : { result: true, data: { status: 1, taskid: "360-task", url: "https://files.example/report.xls" } };
    }
    if (action === "1001201") return { result: true, data: {} };
    return { result: true, data: {} };
  });
  try {
    const count = success(await fixture.run(["response", "count", "--vid", "700001"]), "response count");
    assert.deepEqual(count, { total_count: 42, join_times: 50 });

    const page = success(await fixture.run(["response", "query", "--vid", "700001", "--page_index", "2", "--page_size", "2"]), "response page");
    assert.equal(page.total_count, 42);
    assert.equal(page.page_index, 2);
    const missingTotal = success(await fixture.run(["response", "query", "--vid", "700001"]), "missing total count");
    assert.equal("total_count" in missingTotal, false, "missing total_count must not be invented");

    const firstRealtime = success(await fixture.run(["response", "realtime", "--vid", "700001"]), "first realtime");
    const secondRealtime = success(await fixture.run(["response", "realtime", "--vid", "700001"]), "second realtime");
    assert.equal(firstRealtime.responses.length, 1);
    assert.equal(secondRealtime.responses.length, 0, "queue reads consume the returned records");

    const started = success(await fixture.run(["response", "download", "--vid", "700001"]), "download start");
    const finished = success(await fixture.run(["response", "download", "--vid", "700001", "--taskid", "download-task"]), "download poll");
    assert.equal(started.status, 0);
    assert.equal(finished.status, 1);

    const report = success(await fixture.run(["response", "report", "--vid", "700001"]), "report task");
    assert.equal(report.status, 0);
    const report360 = success(await fixture.run(["response", "360-report", "--vid", "700001"]), "360 start");
    const report360Done = success(await fixture.run(["response", "360-report", "--vid", "700001", "--taskid", "360-task"]), "360 poll");
    assert.equal(report360.status, 0);
    assert.equal(report360Done.status, 1);

    const blocked = await fixture.run(["response", "clear", "--username", "owner", "--vid", "700001"]);
    assert.equal(problem(blocked, "clear without confirmation").code, "CONFIRMATION_REQUIRED");
    assert.equal(fixture.requests().filter((request) => actionOf(request) === "1001201").length, 0);
    const clearResult = await fixture.run(["--yes", "response", "clear", "--username", "owner", "--vid", "700001"]);
    const clearError = problem(clearResult, "clear with confirmation");
    assert.equal(clearError.outcome, "unknown");
    assert.equal(clearError.verification.status, false);
  } finally {
    await fixture.close();
  }
});

test("local analytics reports no-data, anomaly heuristics, and non-statistical comparison", async () => {
  const fixture = await startRoutedFixture(() => ({ result: true, data: {} }));
  try {
    const nps = success(await fixture.run(["analytics", "nps", "--scores", "[]"]), "empty NPS");
    assert.equal(nps.dataStatus, "no-data");
    assert.equal(nps.score, null);
    const csat = success(await fixture.run(["analytics", "csat", "--scores", "[]"]), "empty CSAT");
    assert.equal(csat.dataStatus, "no-data");

    const anomalies = success(await fixture.run([
      "analytics", "anomalies", "--responses", JSON.stringify([
        { jid: 1, answers: ["A", "A", "A"], inputcosttime: 100, ip: "192.0.2.1" },
        { jid: 2, answers: ["A", "A", "A"], inputcosttime: 100, ip: "192.0.2.1" },
      ]),
    ]), "anomaly heuristic");
    assert.ok(anomalies.flagged.some((entry) => entry.reasons.includes("straight-lining")));
    assert.ok(anomalies.flagged.some((entry) => entry.reasons.includes("ip-content-duplicate")));
    assert.ok(anomalies.warnings.some((warning) => /speed-anomaly skipped/i.test(warning)));

    const compare = success(await fixture.run([
      "analytics", "compare", "--set_a", '{"nps":10}', "--set_b", '{"nps":20}',
    ]), "metric comparison");
    assert.equal(compare.comparisons[0].significanceBasis, "heuristic-threshold");
    assert.equal(fixture.requests().length, 0, "analytics commands are local");
  } finally {
    await fixture.close();
  }
});

test("settings preservation and bulk contacts/admin/department/tag payloads remain inspectable", async () => {
  const fixture = await startRoutedFixture(() => ({ result: true, data: { saved: true } }));
  try {
    const settingsArgs = [
      "--yes", "survey", "update-settings", "--vid", "700001",
      "--api_setting", '{"limit_type":1}',
      "--after_submit_setting", '{"show_thanks":true}',
      "--msg_setting", '{"post_url":"https://example.test/hook","quick_post":true}',
      "--sojumpparm_setting", '{"params":[{"name":"source","type":0}]}',
      "--time_setting", '{"begin_time":"2026-01-01 00:00"}',
    ];
    const settingsResult = await fixture.run(settingsArgs);
    const settingsError = problem(settingsResult, "settings update");
    assert.equal(settingsError.outcome, "unknown");
    assert.equal(settingsError.verification.status, false);
    const settingsBody = bodyOf(fixture.requests().find((request) => actionOf(request) === "1000103"));
    for (const key of ["api_setting", "after_submit_setting", "msg_setting", "sojumpparm_setting", "time_setting"]) {
      assert.equal(typeof settingsBody[key], "string", `${key} must be sent as JSON text for full replacement`);
    }

    const commands = [
      ["contacts", "add", ["--corpid", "corp-1", "--users", '[{"userid":"u1","name":"张三"}]', "--auto_create_tag"]],
      ["admin", "add", ["--corpid", "corp-1", "--users", '[{"userid":"u1","role":2}]']],
      ["department", "add", ["--corpid", "corp-1", "--depts", '["研发部/后端"]']],
      ["tag", "add", ["--corpid", "corp-1", "--child_names", '["学历/本科"]']],
    ];
    for (const [scope, command, args] of commands) {
      const result = await fixture.run(["--yes", scope, command, ...args]);
      success(result, `${scope} ${command}`);
    }
    const bodies = fixture.requests().map(bodyOf);
    assert.deepEqual(bodies.find((body) => body.action === "1005002").users, '[{"userid":"u1","name":"张三"}]');
    assert.deepEqual(bodies.find((body) => body.action === "1005004").users, '[{"userid":"u1","role":2}]');
    assert.deepEqual(bodies.find((body) => body.action === "1005102").depts, '["研发部/后端"]');
    assert.deepEqual(bodies.find((body) => body.action === "1005202").child_names, '["学历/本科"]');
  } finally {
    await fixture.close();
  }
});

test("destructive survey and response writes pre-read targets and verify post-state", async () => {
  let surveyStatus = 1;
  let responseCount = 3;
  const settings = {
    api_setting: { limit_type: 0, passing_score: 60 },
    after_submit_setting: { show_thanks: true, thank_words: "thanks" },
    msg_setting: { post_url: "https://example.test/original", quick_post: false, retry: true },
    sojumpparm_setting: { params: [{ name: "source", type: 0 }], signature_verify: false },
    time_setting: { begin_time: "2026-01-01 00:00", end_time: "2026-12-31 23:59" },
  };
  const fixture = await startRoutedFixture(({ action }) => {
    if (action === "1000001") {
      return { result: true, data: { vid: 700001, title: "Target", status: surveyStatus, questions: [] } };
    }
    if (action === "1000003") return { result: true, data: structuredClone(settings) };
    if (action === "1000103") {
      // The fixture models the full-replacement settings write so the
      // subsequent read-back can prove the requested merge was persisted.
      settings.msg_setting.quick_post = true;
      return { result: true, data: { saved: true } };
    }
    if (action === "1000301") {
      surveyStatus = 3;
      return { result: true, data: { deleted: true } };
    }
    if (action === "1001002") {
      return { result: true, data: { total_count: responseCount, responses: responseCount ? [{ jid: 1 }] : [] } };
    }
    if (action === "1001201") {
      responseCount = 0;
      return { result: true, data: { cleared: 3 } };
    }
    return { result: true, data: {} };
  });
  try {
    const settingsResult = success(await fixture.run([
      "--yes", "survey", "update-settings", "--vid", "700001",
      "--msg_setting", '{"quick_post":true}',
    ]), "pre-read settings update");
    assert.equal(settingsResult.verification.status, true);
    const requestsAfterSettings = fixture.requests().map(bodyOf);
    assert.deepEqual(requestsAfterSettings.slice(0, 3).map((body) => body.action), ["1000003", "1000103", "1000003"]);
    const updateBody = requestsAfterSettings[1];
    assert.deepEqual(JSON.parse(updateBody.msg_setting), {
      post_url: "https://example.test/original",
      quick_post: true,
      retry: true,
    });

    const deleteResult = success(await fixture.run([
      "--yes", "survey", "delete", "--vid", "700001", "--username", "owner",
    ]), "verified survey delete");
    assert.equal(deleteResult.verification.status, true);
    const requestsAfterDelete = fixture.requests().map(bodyOf);
    assert.deepEqual(requestsAfterDelete.slice(3, 6).map((body) => body.action), ["1000001", "1000301", "1000001"]);

    const clearResult = success(await fixture.run([
      "--yes", "response", "clear", "--username", "owner", "--vid", "700001",
    ]), "verified response clear");
    assert.equal(clearResult.verification.status, true);
    const actions = fixture.requests().map(bodyOf).map((body) => body.action);
    assert.deepEqual(actions.slice(-3), ["1001002", "1001201", "1001002"]);
  } finally {
    await fixture.close();
  }
});

test("clear-bin verifies an empty recycle-bin listing after the destructive write", async () => {
  let remaining = 2;
  const fixture = await startRoutedFixture(({ action }) => {
    if (action === "1000002") {
      return {
        result: true,
        data: {
          total_count: remaining,
          activitys: remaining ? { "700001": { vid: 700001, status: 3 } } : {},
        },
      };
    }
    if (action === "1000302") {
      remaining = 0;
      return { result: true, data: { cleared: 2 } };
    }
    return { result: true, data: {} };
  });
  try {
    const result = success(await fixture.run([
      "--yes", "survey", "clear-bin", "--username", "owner",
    ]), "verified recycle-bin clear");
    assert.equal(result.verification.status, true);
    assert.equal(result.remaining, 0);
    assert.deepEqual(
      fixture.requests().map((request) => actionOf(request)),
      ["1000002", "1000302", "1000002"],
    );
  } finally {
    await fixture.close();
  }
});

test("clear-bin with a vid uses the verified hard-delete action and polls until status 4", async () => {
  let phase = "pre";
  let postReads = 0;
  const fixture = await startRoutedFixture(({ action }) => {
    if (action === "1000001") {
      if (phase === "pre") return { result: true, data: { vid: 700001, status: 3 } };
      postReads += 1;
      return { result: true, data: { vid: 700001, status: postReads < 2 ? 3 : 4 } };
    }
    if (action === "1000301") {
      phase = "post";
      return { result: true, data: { cleared: 1 } };
    }
    return { result: true, data: {} };
  });
  try {
    const result = success(await fixture.run([
      "--yes", "survey", "clear-bin", "--vid", "700001", "--username", "owner",
    ]), "eventually verified recycle-bin clear");
    assert.equal(result.status, "hard-deleted");
    assert.equal(result.verification.status, true);
    assert.equal(result.outcome, "verified");
    assert.equal(postReads, 2);
    const hardDelete = fixture.requests().find((request) => actionOf(request) === "1000301");
    assert.equal(bodyOf(hardDelete).completely_delete, true);
  } finally {
    await fixture.close();
  }
});

test("completely deleting a survey polls until the service reports hard-deleted", async () => {
  let phase = "pre";
  let postReads = 0;
  const fixture = await startRoutedFixture(({ action }) => {
    if (action === "1000001") {
      if (phase === "pre") return { result: true, data: { vid: 700001, status: 3 } };
      postReads += 1;
      return { result: true, data: { vid: 700001, status: postReads < 2 ? 3 : 4 } };
    }
    if (action === "1000301") {
      phase = "post";
      return { result: true, data: { deleted: true } };
    }
    return { result: true, data: {} };
  });
  try {
    const result = success(await fixture.run([
      "--yes", "survey", "delete", "--vid", "700001", "--username", "owner", "--completely",
    ]), "eventually verified complete delete");
    assert.equal(result.status, "hard-deleted");
    assert.equal(result.verification.status, true);
    assert.equal(result.outcome, "verified");
    assert.equal(postReads, 2);
  } finally {
    await fixture.close();
  }
});

test("deleting a survey polls until the service reports deleted", async () => {
  let phase = "pre";
  let postReads = 0;
  const fixture = await startRoutedFixture(({ action }) => {
    if (action === "1000001") {
      if (phase === "pre") return { result: true, data: { vid: 700001, status: 1 } };
      postReads += 1;
      return { result: true, data: { vid: 700001, status: postReads < 2 ? 1 : 3 } };
    }
    if (action === "1000301") {
      phase = "post";
      return { result: true, data: { deleted: true } };
    }
    return { result: true, data: {} };
  });
  try {
    const result = success(await fixture.run([
      "--yes", "survey", "delete", "--vid", "700001", "--username", "owner",
    ]), "eventually verified delete");
    assert.equal(result.status, "deleted");
    assert.equal(result.verification.status, true);
    assert.equal(result.outcome, "verified");
    assert.equal(postReads, 2);
  } finally {
    await fixture.close();
  }
});

test("normal survey deletion does not accept hard-deleted status as recycle-bin proof", async () => {
  let phase = "pre";
  let postReads = 0;
  const fixture = await startRoutedFixture(({ action }) => {
    if (action === "1000001") {
      if (phase === "pre") return { result: true, data: { vid: 700001, status: 1 } };
      postReads += 1;
      return { result: true, data: { vid: 700001, status: 4 } };
    }
    if (action === "1000301") {
      phase = "post";
      return { result: true, data: { deleted: true } };
    }
    return { result: true, data: {} };
  });
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (typeof delay === "number" && delay <= 2_000) {
      callback(...args);
      return 0;
    }
    return originalSetTimeout(callback, delay, ...args);
  };
  try {
    const result = await fixture.run([
      "--yes", "survey", "delete", "--vid", "700001", "--username", "owner",
    ]);
    const error = problem(result, "normal delete must reject hard-deleted read-back");
    assert.equal(error.outcome, "unknown");
    assert.equal(error.verification.status, false);
    assert.match(error.warnings.join(" "), /状态|回收站|status=3/i);
    assert.equal(postReads, 10);
    assert.equal(fixture.requests().filter((request) => actionOf(request) === "1000301").length, 1);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    await fixture.close();
  }
});

test("completely deleting a survey reports unknown when the read-back is only not-found", async () => {
  let phase = "pre";
  const fixture = await startRoutedFixture(({ action }) => {
    if (action === "1000001") {
      if (phase === "pre") return { result: true, data: { vid: 700001, status: 3 } };
      return { result: false, errormsg: "survey not found" };
    }
    if (action === "1000301") {
      phase = "post";
      return { result: true, data: { deleted: true } };
    }
    return { result: true, data: {} };
  });
  try {
    const result = await fixture.run([
      "--yes", "survey", "delete", "--vid", "700001", "--username", "owner", "--completely",
    ]);
    const error = problem(result, "ambiguous complete delete");
    assert.equal(error.outcome, "unknown");
    assert.equal(error.verification.status, false);
    assert.match(error.warnings.join(" "), /彻底删除|状态|unknown/i);
  } finally {
    await fixture.close();
  }
});

test("survey delete does not verify a terminal status for a different survey id", async () => {
  let phase = "pre";
  const fixture = await startRoutedFixture(({ action }) => {
    if (action === "1000001") {
      return phase === "pre"
        ? { result: true, data: { vid: 700001, status: 1 } }
        : { result: true, data: { vid: 700002, status: 3 } };
    }
    if (action === "1000301") {
      phase = "post";
      return { result: true, data: { deleted: true } };
    }
    return { result: true, data: {} };
  });
  try {
    const result = await fixture.run([
      "--yes", "survey", "delete", "--vid", "700001", "--username", "owner",
    ]);
    const error = problem(result, "delete mismatched read-back identity");
    assert.equal(error.outcome, "unknown");
    assert.equal(error.verification.status, false);
    assert.match(error.warnings.join(" "), /编号|id|身份/i);
    assert.equal(fixture.requests().filter((request) => actionOf(request) === "1000301").length, 1);
  } finally {
    await fixture.close();
  }
});

test("clear-bin with a vid does not verify a terminal status for a different survey id", async () => {
  let phase = "pre";
  const fixture = await startRoutedFixture(({ action }) => {
    if (action === "1000001") {
      return phase === "pre"
        ? { result: true, data: { vid: 700001, status: 3 } }
        : { result: true, data: { vid: 700002, status: 4 } };
    }
    if (action === "1000301") {
      phase = "post";
      return { result: true, data: { cleared: 1 } };
    }
    return { result: true, data: {} };
  });
  try {
    const result = await fixture.run([
      "--yes", "survey", "clear-bin", "--vid", "700001", "--username", "owner",
    ]);
    const error = problem(result, "clear-bin mismatched read-back identity");
    assert.equal(error.outcome, "unknown");
    assert.equal(error.verification.status, false);
    assert.match(error.warnings.join(" "), /编号|id|身份/i);
    assert.equal(fixture.requests().filter((request) => actionOf(request) === "1000301").length, 1);
  } finally {
    await fixture.close();
  }
});

test("clear-bin with a vid refuses to write unless the pre-read status is recycle-bin 3", async () => {
  const fixture = await startRoutedFixture(({ action }) => {
    if (action === "1000001") return { result: true, data: { vid: 700001, status: 1 } };
    if (action === "1000302") return { result: true, data: { cleared: 1 } };
    return { result: true, data: {} };
  });
  try {
    const result = await fixture.run([
      "--yes", "survey", "clear-bin", "--vid", "700001", "--username", "owner",
    ]);
    const error = problem(result, "clear-bin non-recycle survey");
    assert.equal(error.code, "API_ERROR");
    assert.match(error.message, /回收站|状态/);
    assert.equal(fixture.requests().filter((request) => actionOf(request) === "1000302").length, 0);
  } finally {
    await fixture.close();
  }
});

test("unsafe submit transport failure is reported as an unknown outcome after one attempt", async () => {
  let attempts = 0;
  const fixture = await startFixture({
    env: { WJX_API_KEY: API_KEY },
    serverFactory: () => createServer((request, response) => {
      attempts += 1;
      request.resume();
      response.destroy();
    }),
  });
  try {
    const result = await fixture.run([
      "response", "submit", "--no-auto-version", "--vid", "700001", "--inputcosttime", "30",
      "--jpmversion", "7", "--submitdata", "1$1",
    ]);
    const error = problem(result, "ambiguous submit");
    assert.equal(error.code, "API_ERROR");
    assert.equal(error.outcome, "unknown");
    assert.equal(error.attempts, 1);
    assert.equal(attempts, 1, "unsafe submit must never be replayed");
  } finally {
    await fixture.close();
  }
});
