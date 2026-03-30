import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCreateSurveyParams,
  createSurvey,
  getSurvey,
  listSurveys,
  updateSurveyStatus,
  uploadFile,
  submitResponse,
  bindActivity,
  querySurveyBinding,
  querySubAccounts,
  getWjxCredentials,
  validateQuestionsJson,
  WJX_API_URL,
  Action,
} from "../dist/wjx-client.js";
import { signParams } from "../dist/sign.js";

const credentials = { appId: "test-app", appKey: "test-key" };
const validInput = {
  title: "测试问卷",
  type: 0,
  description: "描述",
  questions: '[{"q_index":1,"q_type":3,"q_title":"题目"}]',
};

function mockFetch(responseBody, status = 200) {
  let capturedUrl, capturedInit;
  const fn = async (input, init) => {
    capturedUrl = input;
    capturedInit = init;
    return new Response(JSON.stringify(responseBody), {
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: { "Content-Type": "application/json" },
    });
  };
  fn.captured = () => ({ url: capturedUrl, init: capturedInit });
  return fn;
}

// ─── buildCreateSurveyParams ────────────────────────────────────────

describe("buildCreateSurveyParams", () => {
  it("should include all required fields", () => {
    const result = buildCreateSurveyParams(validInput, credentials, "1700000000");

    assert.equal(result.action, Action.CREATE_SURVEY);
    assert.equal(result.appid, "test-app");
    assert.equal(result.atype, 0);
    assert.equal(result.desc, "描述");
    assert.equal(result.title, "测试问卷");
    assert.equal(result.ts, "1700000000");
    assert.equal(result.publish, false);
  });

  it("should not include encode in signed params", () => {
    const result = buildCreateSurveyParams(validInput, credentials, "1700000000");
    assert.equal("encode" in result, false);
  });

  it("should include sign field", () => {
    const result = buildCreateSurveyParams(validInput, credentials, "1700000000");
    assert.ok("sign" in result);
    assert.match(result.sign, /^[0-9a-f]{40}$/);
  });

  it("should NOT include appKey in output", () => {
    const result = buildCreateSurveyParams(validInput, credentials, "1700000000");
    assert.equal("appKey" in result, false);
    assert.equal("appkey" in result, false);
  });

  it("should compute correct sign matching manual calculation (encode excluded)", () => {
    const ts = "1700000000";
    const result = buildCreateSurveyParams(validInput, credentials, ts);

    const paramsForSign = {
      action: Action.CREATE_SURVEY,
      appid: credentials.appId,
      atype: validInput.type,
      desc: validInput.description,
      publish: false,
      questions: validInput.questions,
      title: validInput.title,
      ts,
    };
    const expectedSign = signParams(paramsForSign, credentials.appKey);
    assert.equal(result.sign, expectedSign);
  });

  it("should set publish to true when provided", () => {
    const input = { ...validInput, publish: true };
    const result = buildCreateSurveyParams(input, credentials, "1700000000");
    assert.equal(result.publish, true);
  });

  it("should default publish to false when not provided", () => {
    const { publish, ...inputWithoutPublish } = validInput;
    const result = buildCreateSurveyParams(inputWithoutPublish, credentials, "1700000000");
    assert.equal(result.publish, false);
  });

  it("should use CREATE_SURVEY action", () => {
    const result = buildCreateSurveyParams(validInput, credentials, "100");
    assert.equal(result.action, "1000101");
  });

  it("should produce different signs for different timestamps", () => {
    const r1 = buildCreateSurveyParams(validInput, credentials, "100");
    const r2 = buildCreateSurveyParams(validInput, credentials, "200");
    assert.notEqual(r1.sign, r2.sign);
  });

  it("should produce different signs for different appKeys", () => {
    const cred1 = { appId: "app", appKey: "key1" };
    const cred2 = { appId: "app", appKey: "key2" };
    const r1 = buildCreateSurveyParams(validInput, cred1, "100");
    const r2 = buildCreateSurveyParams(validInput, cred2, "100");
    assert.notEqual(r1.sign, r2.sign);
  });

  it("should throw on invalid questions JSON", () => {
    const input = { ...validInput, questions: "not valid json{" };
    assert.throws(
      () => buildCreateSurveyParams(input, credentials, "100"),
      /questions must be valid JSON/,
    );
  });

  it("should match the golden value (encode excluded from sign)", () => {
    const result = buildCreateSurveyParams(
      {
        title: "满意度调查",
        type: 1,
        description: "服务满意度调查",
        publish: true,
        questions: '[{"q_index":1,"q_type":3,"q_title":"你满意吗？"}]',
      },
      { appId: "demo-app", appKey: "demo-key" },
      "1700000000",
    );
    assert.equal(result.sign, "4785e9ceec67dc4ddfca8f6abf8706c258990c30");
  });
});

// ─── validateQuestionsJson ──────────────────────────────────────────

describe("validateQuestionsJson", () => {
  it("should accept valid JSON array with q_index and q_type", () => {
    assert.doesNotThrow(() => validateQuestionsJson('[{"q_index":1,"q_type":3}]'));
  });

  it("should accept empty JSON array", () => {
    assert.doesNotThrow(() => validateQuestionsJson("[]"));
  });

  it("should reject valid JSON object (not an array)", () => {
    assert.throws(
      () => validateQuestionsJson('{"key":"value"}'),
      /must be a JSON array/,
    );
  });

  it("should throw on invalid JSON", () => {
    assert.throws(
      () => validateQuestionsJson("not json"),
      /questions must be valid JSON/,
    );
  });

  it("should throw on malformed JSON", () => {
    assert.throws(
      () => validateQuestionsJson("[{incomplete"),
      /questions must be valid JSON/,
    );
  });

  it("should reject question missing q_index", () => {
    assert.throws(
      () => validateQuestionsJson('[{"q_type":3}]'),
      /questions\[0\] missing required field "q_index"/,
    );
  });

  it("should reject question missing q_type", () => {
    assert.throws(
      () => validateQuestionsJson('[{"q_index":1}]'),
      /questions\[0\] missing required field "q_type"/,
    );
  });

  it("should reject question with string q_index", () => {
    assert.throws(
      () => validateQuestionsJson('[{"q_index":"1","q_type":3}]'),
      /questions\[0\] missing required field "q_index"/,
    );
  });

  it("should validate all questions in the array", () => {
    assert.throws(
      () => validateQuestionsJson('[{"q_index":1,"q_type":3},{"q_index":2}]'),
      /questions\[1\] missing required field "q_type"/,
    );
  });
});

// ─── getWjxCredentials ──────────────────────────────────────────────

describe("getWjxCredentials", () => {
  it("should return credentials when both env vars are set", () => {
    const env = { WJX_APP_ID: "id123", WJX_APP_KEY: "key456" };
    const result = getWjxCredentials(env);
    assert.equal(result.appId, "id123");
    assert.equal(result.appKey, "key456");
  });

  it("should throw when WJX_APP_ID is missing", () => {
    assert.throws(
      () => getWjxCredentials({ WJX_APP_KEY: "key" }),
      /WJX_APP_ID and WJX_APP_KEY must be set/,
    );
  });

  it("should throw when WJX_APP_KEY is missing", () => {
    assert.throws(
      () => getWjxCredentials({ WJX_APP_ID: "id" }),
      /WJX_APP_ID and WJX_APP_KEY must be set/,
    );
  });

  it("should throw when both env vars are missing", () => {
    assert.throws(
      () => getWjxCredentials({}),
      /WJX_APP_ID and WJX_APP_KEY must be set/,
    );
  });

  it("should throw when WJX_APP_ID is empty string", () => {
    assert.throws(
      () => getWjxCredentials({ WJX_APP_ID: "", WJX_APP_KEY: "key" }),
      /WJX_APP_ID and WJX_APP_KEY must be set/,
    );
  });
});

// ─── createSurvey ───────────────────────────────────────────────────

describe("createSurvey", () => {
  it("should POST to WJX_API_URL with JSON content type", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await createSurvey(validInput, credentials, fetch, "1700000000");

    const { url, init } = fetch.captured();
    assert.ok(url.startsWith(WJX_API_URL), `URL should start with ${WJX_API_URL}`);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  it("should include sign in the request body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await createSurvey(validInput, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.ok("sign" in body);
    assert.match(body.sign, /^[0-9a-f]{40}$/);
    assert.equal(body.action, "1000101");
    assert.equal(body.appid, "test-app");
  });

  it("should return parsed API success response", async () => {
    const mockResponse = { result: true, data: { surveyId: 999 } };
    const result = await createSurvey(validInput, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });

  it("should return parsed API error response", async () => {
    const mockResponse = { result: false, errormsg: "参数错误" };
    const result = await createSurvey(validInput, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error status", async () => {
    await assert.rejects(
      () => createSurvey(validInput, credentials, mockFetch("Internal Error", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should throw on 404 status", async () => {
    await assert.rejects(
      () => createSurvey(validInput, credentials, mockFetch("Not Found", 404), "100"),
      /WJX API request failed with 404/,
    );
  });

  it("should pass optional creater when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await createSurvey(
      { ...validInput, creater: "sub_user1" },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.creater, "sub_user1");
  });

  it("should not include creater when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await createSurvey(validInput, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("creater" in body, false);
  });
});

// ─── getSurvey ──────────────────────────────────────────────────────

describe("getSurvey", () => {
  it("should POST with action 1000001 and vid", async () => {
    const fetch = mockFetch({ result: true, data: { vid: 12345 } });
    await getSurvey({ vid: 12345 }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, "1000001");
    assert.equal(body.vid, 12345);
    assert.equal(body.appid, "test-app");
    assert.ok("sign" in body);
  });

  it("should default get_questions and get_items to true", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getSurvey({ vid: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.get_questions, true);
    assert.equal(body.get_items, true);
  });

  it("should allow disabling get_questions and get_items", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getSurvey(
      { vid: 1, get_questions: false, get_items: false },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.get_questions, false);
    assert.equal(body.get_items, false);
  });

  it("should return parsed response", async () => {
    const mockResponse = { result: true, data: { vid: 123, title: "测试" } };
    const result = await getSurvey({ vid: 123 }, credentials, mockFetch(mockResponse), "100");
    assert.deepEqual(result, mockResponse);
  });

  it("should throw on HTTP error", async () => {
    await assert.rejects(
      () => getSurvey({ vid: 1 }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });

  it("should pass optional get_exts, get_setting, get_page_cut, get_tags, showtitle", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getSurvey(
      { vid: 1, get_exts: true, get_setting: true, get_page_cut: true, get_tags: true, showtitle: true },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.get_exts, true);
    assert.equal(body.get_setting, true);
    assert.equal(body.get_page_cut, true);
    assert.equal(body.get_tags, true);
    assert.equal(body.showtitle, true);
  });

  it("should not include optional get_survey params when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getSurvey({ vid: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("get_exts" in body, false);
    assert.equal("get_setting" in body, false);
    assert.equal("get_page_cut" in body, false);
    assert.equal("get_tags" in body, false);
    assert.equal("showtitle" in body, false);
  });
});

// ─── listSurveys ────────────────────────────────────────────────────

describe("listSurveys", () => {
  it("should POST with action 1000002", async () => {
    const fetch = mockFetch({ result: true, data: { total_count: 0, activitys: {} } });
    await listSurveys({}, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, "1000002");
    assert.equal(body.appid, "test-app");
    assert.ok("sign" in body);
  });

  it("should default page_index=1 and page_size=10", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listSurveys({}, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.page_index, 1);
    assert.equal(body.page_size, 10);
  });

  it("should pass optional filters", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listSurveys(
      { status: 1, atype: 3, name_like: "test", sort: 2 },
      credentials,
      fetch,
      "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.status, 1);
    assert.equal(body.atype, 3);
    assert.equal(body.name_like, "test");
    assert.equal(body.sort, 2);
  });

  it("should not include undefined optional fields in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listSurveys({}, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("status" in body, false);
    assert.equal("atype" in body, false);
    assert.equal("name_like" in body, false);
    assert.equal("sort" in body, false);
  });

  it("should pass new optional filters (creater, folder, verify_status, etc.)", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listSurveys(
      { creater: "sub1", folder: "测试", is_xingbiao: true, query_all: true, verify_status: 1, time_type: 0, begin_time: 1700000000000, end_time: 1700100000000 },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.creater, "sub1");
    assert.equal(body.folder, "测试");
    assert.equal(body.is_xingbiao, true);
    assert.equal(body.query_all, true);
    assert.equal(body.verify_status, 1);
    assert.equal(body.time_type, 0);
    assert.equal(body.begin_time, 1700000000000);
    assert.equal(body.end_time, 1700100000000);
  });

  it("should not include new optional fields when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listSurveys({}, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("creater" in body, false);
    assert.equal("folder" in body, false);
    assert.equal("is_xingbiao" in body, false);
    assert.equal("query_all" in body, false);
    assert.equal("verify_status" in body, false);
    assert.equal("time_type" in body, false);
    assert.equal("begin_time" in body, false);
    assert.equal("end_time" in body, false);
  });
});

// ─── updateSurveyStatus ─────────────────────────────────────────────

describe("updateSurveyStatus", () => {
  it("should POST with action 1000102", async () => {
    const fetch = mockFetch({ result: true, data: { vid: "123", state: 1 } });
    await updateSurveyStatus({ vid: 123, state: 1 }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, "1000102");
    assert.equal(body.vid, 123);
    assert.equal(body.state, 1);
    assert.equal(body.appid, "test-app");
    assert.ok("sign" in body);
  });

  it("should support state=2 (pause)", async () => {
    const fetch = mockFetch({ result: true, data: { vid: "1", state: 2 } });
    const result = await updateSurveyStatus({ vid: 1, state: 2 }, credentials, fetch, "100");
    assert.deepEqual(result, { result: true, data: { vid: "1", state: 2 } });
  });

  it("should support state=3 (delete)", async () => {
    const fetch = mockFetch({ result: true, data: { vid: "1", state: 3 } });
    const result = await updateSurveyStatus({ vid: 1, state: 3 }, credentials, fetch, "100");
    assert.deepEqual(result, { result: true, data: { vid: "1", state: 3 } });
  });

  it("should throw on HTTP error", async () => {
    await assert.rejects(
      () => updateSurveyStatus({ vid: 1, state: 1 }, credentials, mockFetch("err", 500), "100"),
      /WJX API request failed with 500/,
    );
  });
});

// ─── traceid handling ────────────────────────────────────────────────

describe("traceid handling", () => {
  it("createSurvey should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await createSurvey(validInput, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("createSurvey should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await createSurvey(validInput, credentials, fetch, "1700000000");

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="), "URL should contain traceid query param");
  });

  it("getSurvey should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getSurvey({ vid: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("getSurvey should include traceid in URL query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getSurvey({ vid: 1 }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("traceid="), "URL should contain traceid query param");
  });

  it("listSurveys should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listSurveys({}, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });

  it("updateSurveyStatus should NOT include traceid in POST body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await updateSurveyStatus({ vid: 1, state: 1 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("traceid" in body, false, "traceid must not appear in POST body");
  });
});

// ─── retry behavior ─────────────────────────────────────────────────

describe("retry behavior", () => {
  it("createSurvey should NOT retry on 500 (maxRetries=0)", async () => {
    let callCount = 0;
    const fetch = async (input, init) => {
      callCount++;
      return new Response(JSON.stringify("Server Error"), {
        status: 500,
        statusText: "Internal Server Error",
      });
    };

    await assert.rejects(
      () => createSurvey(validInput, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "createSurvey should make exactly 1 request (no retries)");
  });

  it("updateSurveyStatus should NOT retry on 500 (maxRetries=0)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response(JSON.stringify("err"), { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => updateSurveyStatus({ vid: 1, state: 1 }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1, "updateSurveyStatus should make exactly 1 request (no retries)");
  });

  it("getSurvey should retry on 500 (default maxRetries=2)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      if (callCount < 3) {
        return new Response("err", { status: 500, statusText: "Error" });
      }
      return new Response(JSON.stringify({ result: true, data: { vid: 1 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await getSurvey({ vid: 1 }, credentials, fetch, "100");
    assert.equal(callCount, 3, "should have retried twice before succeeding");
    assert.deepEqual(result, { result: true, data: { vid: 1 } });
  });

  it("getSurvey should retry on 429 status", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("Rate limited", { status: 429, statusText: "Too Many Requests" });
      }
      return new Response(JSON.stringify({ result: true, data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await getSurvey({ vid: 1 }, credentials, fetch, "100");
    assert.equal(callCount, 2, "should have retried once after 429");
    assert.deepEqual(result, { result: true, data: {} });
  });

  it("createSurvey should throw on 404 without retry", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response("Not Found", { status: 404, statusText: "Not Found" });
    };

    await assert.rejects(
      () => createSurvey(validInput, credentials, fetch, "100"),
      /WJX API request failed with 404/,
    );
    assert.equal(callCount, 1, "should not retry on 404");
  });

  it("listSurveys should retry on network error (TypeError)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      if (callCount === 1) {
        throw new TypeError("fetch failed");
      }
      return new Response(JSON.stringify({ result: true, data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await listSurveys({}, credentials, fetch, "100");
    assert.equal(callCount, 2, "should have retried after network error");
    assert.deepEqual(result, { result: true, data: {} });
  });
});

// ─── request body structure ─────────────────────────────────────────

describe("request body structure", () => {
  it("createSurvey body should include ts field", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await createSurvey(validInput, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.ts, "1700000000");
  });

  it("createSurvey body should include appid field", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await createSurvey(validInput, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.appid, "test-app");
  });

  it("createSurvey body should NOT include appKey", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await createSurvey(validInput, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("appKey" in body, false, "appKey should never be in request body");
    assert.equal("appkey" in body, false, "appkey should never be in request body");
  });

  it("getSurvey body should include action, vid, appid, ts, sign", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getSurvey({ vid: 42 }, credentials, fetch, "1700000000");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, "1000001");
    assert.equal(body.vid, 42);
    assert.equal(body.appid, "test-app");
    assert.equal(body.ts, "1700000000");
    assert.ok("sign" in body, "body should have sign field");
    assert.match(body.sign, /^[0-9a-f]{40}$/);
  });

  it("listSurveys URL should include action in query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listSurveys({}, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1000002"), "URL should contain action=1000002");
  });

  it("updateSurveyStatus URL should include action in query string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await updateSurveyStatus({ vid: 1, state: 2 }, credentials, fetch, "100");

    const url = fetch.captured().url;
    assert.ok(url.includes("action=1000102"), "URL should contain action=1000102");
  });
});

// ─── edge cases ─────────────────────────────────────────────────────

describe("edge cases", () => {
  it("createSurvey should throw on invalid questions JSON before making request", async () => {
    let fetchCalled = false;
    const fetch = async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ result: true }), { status: 200 });
    };

    await assert.rejects(
      () => createSurvey({ ...validInput, questions: "not json{" }, credentials, fetch, "100"),
      /questions must be valid JSON/,
    );
    assert.equal(fetchCalled, false, "fetch should not be called for invalid input");
  });

  it("getSurvey should pass vid as number in body", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await getSurvey({ vid: 99999 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(typeof body.vid, "number");
    assert.equal(body.vid, 99999);
  });

  it("listSurveys with custom page_size and page_index", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listSurveys({ page_index: 3, page_size: 50 }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.page_index, 3);
    assert.equal(body.page_size, 50);
  });

  it("listSurveys should not include name_like when empty string", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listSurveys({ name_like: "" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("name_like" in body, false, "empty name_like should not be in body");
  });

  it("getWjxCredentials should throw when WJX_APP_KEY is empty string", async () => {
    assert.throws(
      () => getWjxCredentials({ WJX_APP_ID: "id", WJX_APP_KEY: "" }),
      /WJX_APP_ID and WJX_APP_KEY must be set/,
    );
  });
});

// ─── constants ──────────────────────────────────────────────────────

describe("constants", () => {
  it("WJX_API_URL should be the production endpoint", () => {
    assert.equal(WJX_API_URL, "https://www.wjx.cn/openapi/default.aspx");
  });

  it("should export all action codes", () => {
    assert.equal(Action.GET_SURVEY, "1000001");
    assert.equal(Action.LIST_SURVEYS, "1000002");
    assert.equal(Action.CREATE_SURVEY, "1000101");
    assert.equal(Action.UPDATE_STATUS, "1000102");
  });

  it("should export UPLOAD_FILE action code", () => {
    assert.equal(Action.UPLOAD_FILE, "1000104");
  });
});

// ─── uploadFile ─────────────────────────────────────────────────────

describe("uploadFile", () => {
  it("should POST with action 1000104 and file params", async () => {
    const fetch = mockFetch({ result: true, data: { url: "https://example.com/img.png" } });
    await uploadFile({ file_name: "test.png", file: "aGVsbG8=" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, "1000104");
    assert.equal(body.file_name, "test.png");
    assert.equal(body.file, "aGVsbG8=");
    assert.ok("sign" in body);
  });

  it("should NOT retry on 500 (maxRetries=0)", async () => {
    let callCount = 0;
    const fetch = async () => {
      callCount++;
      return new Response("err", { status: 500, statusText: "Error" });
    };

    await assert.rejects(
      () => uploadFile({ file_name: "a.png", file: "data" }, credentials, fetch, "100"),
      /WJX API request failed with 500/,
    );
    assert.equal(callCount, 1);
  });
});

// ─── createSurvey source_vid mode ───────────────────────────────────

describe("createSurvey source_vid mode", () => {
  it("should pass source_vid and skip atype/desc/questions", async () => {
    const fetch = mockFetch({ result: true, data: { vid: 999 } });
    await createSurvey(
      { title: "复制问卷", type: 0, description: "", questions: "", source_vid: "12345" },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.source_vid, "12345");
    assert.equal("atype" in body, false);
    assert.equal("desc" in body, false);
    assert.equal("questions" in body, false);
  });

  it("should not validate questions when source_vid is provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    // passing invalid questions should not throw when source_vid is set
    await assert.doesNotReject(
      () => createSurvey(
        { title: "copy", type: 0, description: "", questions: "invalid json", source_vid: "111" },
        credentials, fetch, "100",
      ),
    );
  });

  it("should pass compress_img and is_string when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await createSurvey(
      { ...validInput, compress_img: true, is_string: true },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.compress_img, true);
    assert.equal(body.is_string, true);
  });

  it("should not include compress_img/is_string when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await createSurvey(validInput, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("compress_img" in body, false);
    assert.equal("is_string" in body, false);
  });
});

// ─── submitResponse submittime ──────────────────────────────────────

describe("submitResponse submittime", () => {
  it("should pass submittime when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await submitResponse(
      { vid: 1, inputcosttime: 30, submitdata: "1$A", submittime: "2026-03-29 12:00:00" },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.submittime, "2026-03-29 12:00:00");
  });

  it("should not include submittime when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await submitResponse(
      { vid: 1, inputcosttime: 30, submitdata: "1$A" },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("submittime" in body, false);
  });
});

// ─── bindActivity ───────────────────────────────────────────────────

describe("bindActivity", () => {
  it("should POST with action BIND_ACTIVITY and required params", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await bindActivity(
      { username: "admin", vid: 100, sysid: 1, uids: '["u1","u2"]' },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, Action.BIND_ACTIVITY);
    assert.equal(body.username, "admin");
    assert.equal(body.vid, 100);
    assert.equal(body.sysid, 1);
    assert.equal(body.uids, '["u1","u2"]');
    assert.ok("sign" in body);
  });

  it("should pass all optional params when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await bindActivity(
      {
        username: "admin", vid: 100, sysid: 1, uids: '["u1"]',
        answer_times: 3, can_chg_answer: true, can_view_result: false, can_hide_qlist: 1,
      },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.answer_times, 3);
    assert.equal(body.can_chg_answer, true);
    assert.equal(body.can_view_result, false);
    assert.equal(body.can_hide_qlist, 1);
  });

  it("should not include optional params when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await bindActivity(
      { username: "admin", vid: 100, sysid: 1, uids: '["u1"]' },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("answer_times" in body, false);
    assert.equal("can_chg_answer" in body, false);
    assert.equal("can_view_result" in body, false);
    assert.equal("can_hide_qlist" in body, false);
  });
});

// ─── querySurveyBinding new params ──────────────────────────────────

describe("querySurveyBinding new params", () => {
  it("should pass join_status/day/week/month/force_join_times when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(
      {
        username: "admin", vid: 100, sysid: 1,
        join_status: 1, day: "20260329", week: "202613", month: "202603", force_join_times: true,
      },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.join_status, 1);
    assert.equal(body.day, "20260329");
    assert.equal(body.week, "202613");
    assert.equal(body.month, "202603");
    assert.equal(body.force_join_times, true);
  });

  it("should not include new params when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySurveyBinding(
      { username: "admin", vid: 100, sysid: 1 },
      credentials, fetch, "100",
    );

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("join_status" in body, false);
    assert.equal("day" in body, false);
    assert.equal("week" in body, false);
    assert.equal("month" in body, false);
    assert.equal("force_join_times" in body, false);
  });
});

// ─── querySubAccounts mobile ────────────────────────────────────────

describe("querySubAccounts mobile", () => {
  it("should pass mobile when provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts({ mobile: "13800138000" }, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.mobile, "13800138000");
  });

  it("should not include mobile when not provided", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await querySubAccounts({}, credentials, fetch, "100");

    const body = JSON.parse(fetch.captured().init.body);
    assert.equal("mobile" in body, false);
  });
});
