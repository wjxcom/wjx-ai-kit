import assert from "node:assert/strict";
import test from "node:test";

import {
  queryResponses,
  queryResponsesRealtime,
  downloadResponses,
  getReport,
  getSurveySettings,
  updateSurveySettings,
  deleteSurvey,
  submitResponse,
  getQuestionTags,
  getFileLinks,
  getWjxApiUrl,
  Action,
} from "../dist/index.js";

const credentials = { apiKey: "test-token" };

function mockFetch(responseData, { status = 200 } = {}) {
  let capturedUrl;
  let capturedInit;

  const impl = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response(JSON.stringify(responseData), {
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: { "Content-Type": "application/json" },
    });
  };

  return { impl, getUrl: () => capturedUrl, getInit: () => capturedInit };
}

function parsedBody(mock) {
  return JSON.parse(mock.getInit().body);
}

function assertBearerAuth(init, body) {
  assert.equal(init.headers["Authorization"], "Bearer test-token");
  assert.equal("sign" in body, false, "sign should not be in body");
  assert.equal("appid" in body, false, "appid should not be in body");
  assert.equal("ts" in body, false, "ts should not be in body");
}

// ═══ queryResponses (1001002) ═══════════════════════════════════════

test("queryResponses", async (t) => {
  await t.test("should POST with action 1001002 and vid", async () => {
    const mock = mockFetch({ result: true, data: { answers: {} } });
    await queryResponses({ vid: 12345 }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal(body.action, Action.QUERY_RESPONSES);
    assert.equal(body.vid, 12345);
    assert.ok(mock.getUrl().includes("action=1001002"));
    assertBearerAuth(mock.getInit(), body);
  });

  await t.test("should include optional filtering parameters", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await queryResponses(
      {
        vid: 100,
        valid: false,
        page_index: 2,
        page_size: 20,
        sort: 1,
        min_index: 50,
        begin_time: 1700000000000,
        end_time: 1700100000000,
      },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.valid, false);
    assert.equal(body.page_index, 2);
    assert.equal(body.page_size, 20);
    assert.equal(body.sort, 1);
    assert.equal(body.min_index, 50);
    assert.equal(body.begin_time, 1700000000000);
    assert.equal(body.end_time, 1700100000000);
  });

  await t.test("should include jid, sojumpparm, qid parameters", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await queryResponses(
      { vid: 100, jid: "123,456", sojumpparm: "abc,def", qid: "1,2,3" },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.jid, "123,456");
    assert.equal(body.sojumpparm, "abc,def");
    assert.equal(body.qid, "1,2,3");
  });

  await t.test("should include conds parameter", async () => {
    const conds = JSON.stringify([{ q_index: 1, opt: "=", val: "1" }]);
    const mock = mockFetch({ result: true, data: {} });
    await queryResponses(
      { vid: 100, conds },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.conds, conds);
  });

  await t.test("should not include undefined optional fields", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await queryResponses({ vid: 100 }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal("page_index" in body, false);
    assert.equal("jid" in body, false);
    assert.equal("conds" in body, false);
  });

  await t.test("should not include traceid in POST body", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await queryResponses({ vid: 100 }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal("traceid" in body, false);
    assert.ok(mock.getUrl().includes("traceid="));
  });

  await t.test("should return parsed response", async () => {
    const responseData = {
      result: true,
      data: { vid: 100, total_count: 5, answers: {} },
    };
    const mock = mockFetch(responseData);
    const result = await queryResponses({ vid: 100 }, credentials, mock.impl);

    assert.deepEqual(result, responseData);
  });
});

// ═══ queryResponsesRealtime (1001003) ═══════════════════════════════

test("queryResponsesRealtime", async (t) => {
  await t.test("should POST with action 1001003 and vid", async () => {
    const mock = mockFetch({ result: true, data: [] });
    await queryResponsesRealtime({ vid: 200 }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal(body.action, Action.QUERY_RESPONSES_REALTIME);
    assert.equal(body.vid, 200);
    assertBearerAuth(mock.getInit(), body);
  });

  await t.test("should include count parameter", async () => {
    const mock = mockFetch({ result: true, data: [] });
    await queryResponsesRealtime({ vid: 200, count: 10 }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal(body.count, 10);
  });

  await t.test("should not include count when undefined", async () => {
    const mock = mockFetch({ result: true, data: [] });
    await queryResponsesRealtime({ vid: 200 }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal("count" in body, false);
  });
});

// ═══ downloadResponses (1001004) ════════════════════════════════════

test("downloadResponses", async (t) => {
  await t.test("should POST with action 1001004 and vid", async () => {
    const mock = mockFetch({ result: true, data: { status: 1, download_url: "https://example.com/file.csv" } });
    await downloadResponses({ vid: 300 }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal(body.action, Action.DOWNLOAD_RESPONSES);
    assert.equal(body.vid, 300);
    assertBearerAuth(mock.getInit(), body);
  });

  await t.test("should include format and query parameters", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await downloadResponses(
      { vid: 300, suffix: 1, query_type: 2, query_record: true, sort: 1 },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.suffix, 1);
    assert.equal(body.query_type, 2);
    assert.equal(body.query_record, true);
    assert.equal(body.sort, 1);
  });

  await t.test("should include taskid for polling", async () => {
    const mock = mockFetch({ result: true, data: { status: 0 } });
    await downloadResponses({ vid: 300, taskid: 12345 }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal(body.taskid, 12345);
  });

  await t.test("should include time range parameters", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await downloadResponses(
      { vid: 300, begin_time: 1700000000000, end_time: 1700100000000, min_index: 10 },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.begin_time, 1700000000000);
    assert.equal(body.end_time, 1700100000000);
    assert.equal(body.min_index, 10);
  });
});

// ═══ getReport (1001101) ════════════════════════════════════════════

test("getReport", async (t) => {
  await t.test("should POST with action 1001101 and vid", async () => {
    const mock = mockFetch({ result: true, data: { answer_report: {} } });
    await getReport({ vid: 400 }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal(body.action, Action.GET_REPORT);
    assert.equal(body.vid, 400);
    assertBearerAuth(mock.getInit(), body);
  });

  await t.test("should include filtering parameters", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await getReport(
      {
        vid: 400,
        valid: false,
        min_index: 5,
        jid: "100,200",
        sojumpparm: "p1,p2",
        begin_time: 1700000000000,
        end_time: 1700100000000,
        distinct_user: true,
      },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.valid, false);
    assert.equal(body.min_index, 5);
    assert.equal(body.jid, "100,200");
    assert.equal(body.distinct_user, true);
  });

  await t.test("should not include undefined optional fields", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await getReport({ vid: 400 }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal("valid" in body, false);
    assert.equal("conds" in body, false);
  });
});

// ═══ getSurveySettings (1000003) ════════════════════════════════════

test("getSurveySettings", async (t) => {
  await t.test("should POST with action 1000003 and vid", async () => {
    const mock = mockFetch({ result: true, data: { time_setting: {} } });
    await getSurveySettings({ vid: 500 }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal(body.action, Action.GET_SETTINGS);
    assert.equal(body.vid, 500);
    assert.equal(body.additional_setting, "[1000,1001,1002,1003,1004,1005,1006,1007]");
    assertBearerAuth(mock.getInit(), body);
  });

  await t.test("should use custom additional_setting when provided", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await getSurveySettings({ vid: 500, additional_setting: "[1000]" }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal(body.additional_setting, "[1000]");
  });

  await t.test("should return parsed settings response", async () => {
    const responseData = {
      result: true,
      data: { time_setting: { begin_time: "2024-01-01 00:00:00" } },
    };
    const mock = mockFetch(responseData);
    const result = await getSurveySettings({ vid: 500 }, credentials, mock.impl);

    assert.deepEqual(result, responseData);
  });
});

// ═══ updateSurveySettings (1000103) ═════════════════════════════════

test("updateSurveySettings", async (t) => {
  await t.test("should POST with action 1000103 and vid", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await updateSurveySettings(
      { vid: 600, time_setting: '{"begin_time":"2024-01-01 00:00:00"}' },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.action, Action.UPDATE_SETTINGS);
    assert.equal(body.vid, 600);
    assert.equal(body.time_setting, '{"begin_time":"2024-01-01 00:00:00"}');
    assertBearerAuth(mock.getInit(), body);
  });

  await t.test("should only include provided setting fields", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await updateSurveySettings(
      { vid: 600, api_setting: '{"limit_type":1}' },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.api_setting, '{"limit_type":1}');
    assert.equal("time_setting" in body, false);
    assert.equal("msg_setting" in body, false);
  });

  await t.test("should not retry on failure (write operation)", async () => {
    let callCount = 0;
    const impl = async () => {
      callCount++;
      return new Response("err", { status: 500, statusText: "Error" });
    };
    await assert.rejects(
      () => updateSurveySettings({ vid: 600 }, credentials, impl),
      /500/,
    );
    assert.equal(callCount, 1, "should not retry write operations");
  });
});

// ═══ deleteSurvey (1000301) ═════════════════════════════════════════

test("deleteSurvey", async (t) => {
  await t.test("should POST with action 1000301, vid, and username", async () => {
    const mock = mockFetch({ result: true });
    await deleteSurvey(
      { vid: 700, username: "admin" },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.action, Action.DELETE_SURVEY);
    assert.equal(body.vid, 700);
    assert.equal(body.username, "admin");
    assertBearerAuth(mock.getInit(), body);
  });

  await t.test("should include completely_delete flag", async () => {
    const mock = mockFetch({ result: true });
    await deleteSurvey(
      { vid: 700, username: "admin", completely_delete: true },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.completely_delete, true);
  });

  await t.test("should not retry (write operation)", async () => {
    let callCount = 0;
    const impl = async () => {
      callCount++;
      return new Response("err", { status: 500, statusText: "Error" });
    };
    await assert.rejects(
      () => deleteSurvey({ vid: 700, username: "admin" }, credentials, impl),
      /500/,
    );
    assert.equal(callCount, 1, "should not retry write operations");
  });
});

// ═══ submitResponse (1001001) ═══════════════════════════════════════

test("submitResponse", async (t) => {
  await t.test("should POST with action 1001001 and required fields", async () => {
    const mock = mockFetch({ result: true, data: { jid: 999, index: 1 } });
    await submitResponse(
      { vid: 800, inputcosttime: 30, submitdata: "1$1}2$2" },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.action, Action.SUBMIT_RESPONSE);
    assert.equal(body.vid, 800);
    assert.equal(body.inputcosttime, 30);
    assert.equal(body.submitdata, "1$1}2$2");
    assertBearerAuth(mock.getInit(), body);
  });

  await t.test("should include optional sojumpparm and udsid", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await submitResponse(
      { vid: 800, inputcosttime: 30, submitdata: "1$1", udsid: 5, sojumpparm: "custom123" },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.udsid, 5);
    assert.equal(body.sojumpparm, "custom123");
  });

  await t.test("should forward jpmversion when provided (defends against 『问卷已被修改』）", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await submitResponse(
      { vid: 800, inputcosttime: 30, submitdata: "1$1", jpmversion: 7 },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.jpmversion, 7);
  });

  await t.test("should omit jpmversion when not provided", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await submitResponse(
      { vid: 800, inputcosttime: 30, submitdata: "1$1" },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.ok(!("jpmversion" in body), "jpmversion should not be present when undefined");
  });

  await t.test("should not retry (write operation)", async () => {
    let callCount = 0;
    const impl = async () => {
      callCount++;
      return new Response("err", { status: 500, statusText: "Error" });
    };
    await assert.rejects(
      () =>
        submitResponse(
          { vid: 800, inputcosttime: 30, submitdata: "1$1" },
          credentials,
          impl,
        ),
      /500/,
    );
    assert.equal(callCount, 1, "should not retry write operations");
  });
});

// ═══ getQuestionTags (1000004) ══════════════════════════════════════

test("getQuestionTags", async (t) => {
  await t.test("should POST with action 1000004 and username", async () => {
    const mock = mockFetch({ result: true, data: [] });
    await getQuestionTags({ username: "testuser" }, credentials, mock.impl);

    const body = parsedBody(mock);
    assert.equal(body.action, Action.GET_TAGS);
    assert.equal(body.username, "testuser");
    assertBearerAuth(mock.getInit(), body);
  });

  await t.test("should return tag list", async () => {
    const responseData = {
      result: true,
      data: [{ tag_id: 1, tag_name: "满意度" }],
    };
    const mock = mockFetch(responseData);
    const result = await getQuestionTags({ username: "testuser" }, credentials, mock.impl);

    assert.deepEqual(result, responseData);
  });
});

// ═══ getFileLinks (1001005) ═════════════════════════════════════════

test("getFileLinks", async (t) => {
  await t.test("should POST with action 1001005, vid, and file_keys", async () => {
    const mock = mockFetch({ result: true, data: { files: {} } });
    await getFileLinks(
      { vid: 900, file_keys: '["file1.png"]' },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.action, Action.GET_FILE_LINKS);
    assert.equal(body.vid, 900);
    assert.equal(body.file_keys, '["file1.png"]');
    assertBearerAuth(mock.getInit(), body);
  });

  await t.test("should include file_view_expires", async () => {
    const mock = mockFetch({ result: true, data: {} });
    await getFileLinks(
      { vid: 900, file_keys: '["file1.png"]', file_view_expires: 24 },
      credentials,
      mock.impl,
    );

    const body = parsedBody(mock);
    assert.equal(body.file_view_expires, 24);
  });
});

// ═══ Action constants ═══════════════════════════════════════════════

test("Action constants for new endpoints", () => {
  assert.equal(Action.QUERY_RESPONSES, "1001002");
  assert.equal(Action.QUERY_RESPONSES_REALTIME, "1001003");
  assert.equal(Action.DOWNLOAD_RESPONSES, "1001004");
  assert.equal(Action.GET_REPORT, "1001101");
  assert.equal(Action.GET_SETTINGS, "1000003");
  assert.equal(Action.UPDATE_SETTINGS, "1000103");
  assert.equal(Action.DELETE_SURVEY, "1000301");
  assert.equal(Action.SUBMIT_RESPONSE, "1001001");
  assert.equal(Action.GET_TAGS, "1000004");
  assert.equal(Action.GET_FILE_LINKS, "1001005");
});
