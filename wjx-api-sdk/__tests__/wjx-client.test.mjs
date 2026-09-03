import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import {
  createSurveyByJson,
  getSurvey,
  listSurveys,
  submitResponse,
  updateSurveyStatus,
  uploadFile,
  getWjxApiUrl,
  callWjxApi,
} from "../dist/index.js";

const require = createRequire(import.meta.url);
const { version: SDK_VERSION } = require("../package.json");
const credentials = { apiKey: "test-token" };

function mockFetch(responseBody, status = 200) {
  let captured;
  const fetch = async (input, init) => {
    captured = { url: String(input), init };
    return new Response(JSON.stringify(responseBody), {
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: { "Content-Type": "application/json" },
    });
  };
  fetch.captured = () => captured;
  return fetch;
}

describe("createSurveyByJson", () => {
  it("posts JSONL to action 1000106 without changing question fields", async () => {
    const jsonl = [
      { qtype: "问卷基础信息", title: "客户满意度" },
      { qtype: "签名题", title: "请签名", issignature: "1" },
    ].map(JSON.stringify).join("\n");
    const fetch = mockFetch({ result: true, data: { vid: 123 } });
    const result = await createSurveyByJson({ jsonl }, credentials, fetch);
    const { url, init } = fetch.captured();
    const body = JSON.parse(init.body);

    assert.equal(result.data.vid, 123);
    assert.ok(url.startsWith(getWjxApiUrl()));
    assert.equal(body.action, "1000106");
    assert.equal(body.title, "客户满意度");
    assert.match(body.surveydatajson, /"qtype":"签名题"/);
    assert.match(body.surveydatajson, /"issignature":"1"/);
  });

  it("rejects an empty JSONL document before transport", async () => {
    let calls = 0;
    const fetch = async () => { calls += 1; return new Response("{}"); };
    await assert.rejects(() => createSurveyByJson({ jsonl: "\ufeff\n" }, credentials, fetch), /jsonl must not be empty/);
    assert.equal(calls, 0);
  });

  it("rejects JSONL over the UTF-8 byte limit before transport", async () => {
    let calls = 0;
    const fetch = async () => { calls += 1; return new Response("{}"); };
    const jsonl = "测".repeat(400_000);
    assert.ok(jsonl.length < 1_000_000);
    assert.ok(Buffer.byteLength(jsonl, "utf8") > 1_000_000);
    await assert.rejects(
      () => createSurveyByJson({ jsonl }, credentials, fetch),
      /exceeds maximum size/,
    );
    assert.equal(calls, 0);
  });

  it("sends an explicit client identity when provided by the caller", async () => {
    const jsonl = [
      { qtype: "问卷基础信息", title: "版本识别测试" },
      { qtype: "单选", title: "选择一个", select: ["A", "B"] },
    ].map(JSON.stringify).join("\n");
    const fetch = mockFetch({ result: true, data: { vid: 456 } });

    await createSurveyByJson(
      { jsonl },
      credentials,
      fetch,
      { clientName: "wjx-cli", clientVersion: "0.4.1" },
    );

    assert.equal(fetch.captured().init.headers["X-WJX-Client"], "wjx-cli");
    assert.equal(fetch.captured().init.headers["X-WJX-Client-Version"], "0.4.1");
  });

  it("sends the SDK identity by default for server-side version gates", async () => {
    const jsonl = [
      { qtype: "问卷基础信息", title: "SDK 默认身份测试" },
      { qtype: "单选", title: "选择一个", select: ["A", "B"] },
    ].map(JSON.stringify).join("\n");
    const fetch = mockFetch({ result: true, data: { vid: 789 } });

    await createSurveyByJson({ jsonl }, credentials, fetch);

    assert.equal(fetch.captured().init.headers["X-WJX-Client"], "wjx-api-sdk");
    assert.equal(fetch.captured().init.headers["X-WJX-Client-Version"], SDK_VERSION);
  });

  it("honors a caller timeout override", async () => {
    const jsonl = [
      { qtype: "问卷基础信息", title: "超时覆盖测试" },
      { qtype: "单选", title: "选择一个", select: ["A", "B"] },
    ].map(JSON.stringify).join("\n");
    let seenSignal;
    const fetch = async (_url, init) => {
      seenSignal = init.signal;
      return new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    };
    await assert.rejects(
      () => createSurveyByJson({ jsonl }, credentials, fetch, { timeoutMs: 1 }),
      /aborted|timed out/i,
    );
    assert.ok(seenSignal);
  });

  it("rejects non-boolean publish values before transport", async () => {
    let calls = 0;
    const fetch = async () => { calls += 1; return new Response("{}"); };
    const jsonl = [
      { qtype: "问卷基础信息", title: "发布类型校验" },
      { qtype: "单选", title: "选择一个", select: ["A", "B"] },
    ].map(JSON.stringify).join("\n");
    await assert.rejects(
      () => createSurveyByJson({ jsonl, publish: "false" }, credentials, fetch),
      /publish must be a boolean/,
    );
    assert.equal(calls, 0);
  });

  it("rejects malformed optional titles, atype, and creator values before transport", async () => {
    let calls = 0;
    const fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ result: true, data: {} }));
    };
    const jsonl = [
      { qtype: "问卷基础信息", title: "创建参数边界测试" },
      { qtype: "单选", title: "选择一个", select: ["A", "B"] },
    ].map(JSON.stringify).join("\n");

    await assert.rejects(
      () => createSurveyByJson({ jsonl, atype: 1.5 }, credentials, fetch),
      /atype must be a finite safe integer/,
    );
    await assert.rejects(
      () => createSurveyByJson({ jsonl, optionalTitles: ["允许", 42] }, credentials, fetch),
      /optionalTitles must be an array of strings/,
    );
    await assert.rejects(
      () => createSurveyByJson({ jsonl, creater: "   " }, credentials, fetch),
      /creater must be a non-empty string/,
    );
    assert.equal(calls, 0);
  });

  it("never retries survey creation even when a retry budget is provided", async () => {
    let calls = 0;
    const jsonl = [
      { qtype: "问卷基础信息", title: "创建重试安全测试" },
      { qtype: "单选", title: "选择一个", select: ["A", "B"] },
    ].map(JSON.stringify).join("\n");
    const fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ result: true, data: {} }), {
        status: 500,
        statusText: "Server Error",
        headers: { "Content-Type": "application/json" },
      });
    };

    await assert.rejects(
      () => createSurveyByJson({ jsonl }, credentials, fetch, { retryBudget: 3 }),
      /500 Server Error/,
    );
    assert.equal(calls, 1);
  });
});

describe("survey read and lifecycle clients", () => {
  it("gets a survey with default question and item flags", async () => {
    const fetch = mockFetch({ result: true, data: { vid: 9 } });
    await getSurvey({ vid: 9 }, credentials, fetch);
    const body = JSON.parse(fetch.captured().init.body);
    assert.deepEqual({ action: body.action, vid: body.vid, get_questions: body.get_questions, get_items: body.get_items }, {
      action: "1000001", vid: 9, get_questions: true, get_items: true,
    });
  });

  it("lists surveys with paging filters", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await listSurveys({ page_index: 2, page_size: 50, status: 1, name_like: "客户" }, credentials, fetch);
    const body = JSON.parse(fetch.captured().init.body);
    assert.equal(body.action, "1000002");
    assert.equal(body.page_index, 2);
    assert.equal(body.page_size, 50);
    assert.equal(body.status, 1);
    assert.equal(body.name_like, "客户");
  });

  it("updates status and uploads files without retries", async () => {
    const statusFetch = mockFetch({ result: true, data: {} });
    await updateSurveyStatus({ vid: 9, state: 1 }, credentials, statusFetch);
    assert.equal(JSON.parse(statusFetch.captured().init.body).action, "1000102");

    const uploadFetch = mockFetch({ result: true, data: {} });
    await uploadFile({ file_name: "proof.png", file: "aGVsbG8=" }, credentials, uploadFetch);
    const body = JSON.parse(uploadFetch.captured().init.body);
    assert.equal(body.action, "1000104");
    assert.equal(body.file_name, "proof.png");
  });
});

describe("submitResponse retry safety", () => {
  it("never retries a response submission even when retryBudget is provided", async () => {
    let calls = 0;
    const fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ result: true, data: {} }), {
        status: 500,
        statusText: "Server Error",
        headers: { "Content-Type": "application/json" },
      });
    };

    await assert.rejects(
      () => submitResponse(
        { vid: 42, inputcosttime: 30, submitdata: "1$1" },
        credentials,
        fetch,
        { retryBudget: 3 },
      ),
      /500 Server Error/,
    );
    assert.equal(calls, 1);
  });
});

describe("transport option boundaries", () => {
  it("routes concurrent requests through their own base URLs", async () => {
    const seen = [];
    const fetchFor = (delay) => async (input) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      seen.push(String(input));
      return new Response(JSON.stringify({ result: true, data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    await Promise.all([
      callWjxApi({ action: "1000001" }, {
        credentials: { apiKey: "a", baseUrl: "https://profile-a.test" },
        fetchImpl: fetchFor(20),
      }),
      callWjxApi({ action: "1000001" }, {
        credentials: { apiKey: "b", baseUrl: "https://profile-b.test" },
        fetchImpl: fetchFor(5),
      }),
    ]);

    assert.equal(seen.filter((url) => url.startsWith("https://profile-a.test/")).length, 1);
    assert.equal(seen.filter((url) => url.startsWith("https://profile-b.test/")).length, 1);
    assert.match(seen.find((url) => url.startsWith("https://profile-a.test/")), /\/openapi\/default\.aspx\?traceid=.*&action=1000001/);
    assert.match(seen.find((url) => url.startsWith("https://profile-b.test/")), /\/openapi\/default\.aspx\?traceid=.*&action=1000001/);
  });

  it("accepts an OpenAPI endpoint in baseUrl without duplicating its path", async () => {
    const fetch = mockFetch({ result: true, data: {} });
    await callWjxApi(
      { action: "1000001" },
      { credentials: { apiKey: "test", baseUrl: "https://profile.test/openapi/default.aspx" }, fetchImpl: fetch },
    );
    assert.match(fetch.captured().url, /^https:\/\/profile\.test\/openapi\/default\.aspx\?/);
  });

  it("rejects non-finite, negative, fractional, and excessive retry budgets before transport", async () => {
    for (const retryBudget of [Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY, 10_001]) {
      let calls = 0;
      const fetch = async () => {
        calls += 1;
        return new Response(JSON.stringify({ result: true, data: {} }));
      };
      await assert.rejects(
        () => listSurveys({}, credentials, fetch, { retryBudget }),
        /retryBudget.*(?:integer|finite|between|0)/i,
      );
      assert.equal(calls, 0, `invalid retryBudget=${retryBudget} must not call fetch`);
    }
  });

  it("rejects invalid timeout values before transport", async () => {
    for (const timeoutMs of [Number.NaN, -1, 0, 1.5, Number.POSITIVE_INFINITY]) {
      let calls = 0;
      const fetch = async () => {
        calls += 1;
        return new Response(JSON.stringify({ result: true, data: {} }));
      };
      await assert.rejects(
        () => listSurveys({}, credentials, fetch, { timeoutMs }),
        /timeoutMs.*(?:integer|finite|positive|between)/i,
      );
      assert.equal(calls, 0, `invalid timeoutMs=${timeoutMs} must not call fetch`);
    }
  });

  it("retries common ECONN errors", async () => {
    for (const message of ["ECONNRESET", "ECONNREFUSED", "ECONNABORTED"]) {
      let calls = 0;
      const fetch = async () => {
        calls += 1;
        throw new TypeError(message);
      };
      await assert.rejects(
        () => listSurveys({}, credentials, fetch, { retryBudget: 1 }),
        new RegExp(message),
      );
      assert.equal(calls, 2, `${message} should be retried once`);
    }
  });

  it("keeps exponential retry delays finite for large retry budgets", async () => {
    const originalSetTimeout = globalThis.setTimeout;
    const delays = [];
    globalThis.setTimeout = ((callback, delay, ...args) => {
      delays.push(delay);
      return originalSetTimeout(callback, 0, ...args);
    });
    try {
      await assert.rejects(
        () => listSurveys({}, credentials, async () => { throw new TypeError("ECONNRESET"); }, { retryBudget: 1_024 }),
        /ECONNRESET/,
      );
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
    assert.ok(delays.length > 1);
    assert.ok(delays.every((delay) => Number.isFinite(delay)), "retry timers must never receive Infinity");
  });
});

describe("submitdata numbering", () => {
  it("preserves raw q_index values when metadata includes non-answerable rows", async () => {
    const { normalizeSubmitdata } = await import("../dist/modules/response/submitdata.js");
    const questions = [
      { q_index: 1, q_type: 1, q_subtype: 1 },
      { q_index: 2, q_type: 3, q_subtype: 3 },
      { q_index: 3, q_type: 3, q_subtype: 3 },
    ];
    assert.equal(normalizeSubmitdata("2$A}3$B", questions), "2$A}3$B");
  });
});
