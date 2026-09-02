import { test } from "node:test";
import assert from "node:assert/strict";
import { callWjxApi, callWjxContactsApi, callWjxSubuserApi, callWjxUserSystemApi, getWjxApiUrl, getWjxBaseUrl, getWjxCredentials, listSurveys, submitResponse } from "../dist/index.js";

test("SDK accepts additive retryBudget and traceId options", async () => {
  let calls = 0;
  const response = await callWjxApi({ action: "test" }, {
    credentials: { apiKey: "key" }, retryBudget: 0, traceId: "trace-test",
    fetchImpl: async (url) => { calls += 1; assert.match(String(url), /trace-test/); return new Response(JSON.stringify({ result: true, data: { ok: true } })); },
  });
  assert.equal(calls, 1); assert.equal(response.result, true);
});

test("module clients forward additive transport overrides without changing defaults", async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ result: true, data: {} }));
  };
  await listSurveys({}, { apiKey: "key" }, fetchImpl, { retryBudget: 0, timeoutMs: 1234, traceId: "list-trace" });
  await submitResponse({ vid: 7, inputcosttime: 1, submitdata: "1$yes" }, { apiKey: "key" }, fetchImpl, { traceId: "submit-trace" });
  assert.equal(urls.length, 2);
  assert.match(urls[0], /traceid=list-trace/);
  assert.match(urls[1], /traceid=submit-trace/);
});

test("SDK rejects blank credentials before invoking transport", async () => {
  let calls = 0;
  await assert.rejects(
    () => callWjxApi({ action: "test" }, {
      credentials: { apiKey: "   " },
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ result: true, data: {} }));
      },
    }),
    /WJX_API_KEY must be set/,
  );
  assert.equal(calls, 0);
  assert.throws(() => getWjxCredentials({ WJX_API_KEY: " \t" }), /WJX_API_KEY must be set/);
});

test("all SDK transports reject blank explicit credentials before invoking transport", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ result: true, data: {} }));
  };
  for (const transport of [callWjxApi, callWjxUserSystemApi, callWjxSubuserApi, callWjxContactsApi]) {
    await assert.rejects(
      () => transport({ action: "test" }, { credentials: { apiKey: "\t  " }, fetchImpl, retryBudget: 0 }),
      /WJX_API_KEY must be set/,
    );
  }
  assert.equal(calls, 0);
});

test("blank endpoint environment values fall back to the documented defaults", () => {
  const previous = {
    WJX_BASE_URL: process.env.WJX_BASE_URL,
    WJX_API_URL: process.env.WJX_API_URL,
  };
  try {
    process.env.WJX_BASE_URL = "   ";
    process.env.WJX_API_URL = "\t";
    assert.equal(getWjxBaseUrl(), "https://www.wjx.cn");
    assert.equal(getWjxApiUrl(), "https://www.wjx.cn/openapi/default.aspx");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("blank explicit base URLs do not override credential or environment routing", async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ result: true, data: {} }));
  };
  await callWjxApi({ action: "test" }, {
    credentials: { apiKey: "key", baseUrl: "https://credential.example" },
    baseUrl: "  ",
    fetchImpl,
    retryBudget: 0,
  });
  assert.match(urls[0], /^https:\/\/credential\.example\/openapi\/default\.aspx\?/);
});

test("SDK retries ordinary Error network failures and AbortError values", async () => {
  for (const { error, expected } of [
    { error: new Error("ECONNRESET"), expected: /ECONNRESET/ },
    { error: Object.assign(new Error("request aborted"), { name: "AbortError" }), expected: /timed out/i },
  ]) {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      throw error;
    };
    await assert.rejects(
      () => callWjxApi({ action: "test" }, { credentials: { apiKey: "key" }, fetchImpl, retryBudget: 1 }),
      expected,
    );
    assert.equal(calls, 2);
  }
});

test("SDK retries network errors identified only by their standard error code", async () => {
  let calls = 0;
  const error = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
  await assert.rejects(
    () => callWjxApi({ action: "test" }, {
      credentials: { apiKey: "key" },
      fetchImpl: async () => {
        calls += 1;
        throw error;
      },
      retryBudget: 1,
    }),
    /socket hang up/,
  );
  assert.equal(calls, 2);
});

test("SDK releases non-2xx response bodies before retrying", async () => {
  let calls = 0;
  let cancelled = false;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("temporary failure"));
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(body, { status: 500, statusText: "Server Error" });
    }
    return new Response(JSON.stringify({ result: true, data: { ok: true } }), {
      headers: { "content-type": "application/json" },
    });
  };

  const response = await callWjxApi(
    { action: "test" },
    { credentials: { apiKey: "key" }, fetchImpl, retryBudget: 1 },
  );

  assert.equal(response.result, true);
  assert.equal(calls, 2);
  assert.equal(cancelled, true, "retrying must release the previous response body");
});

test("SDK rejects non-object JSON responses with a stable diagnostic", async () => {
  await assert.rejects(
    () => callWjxApi({ action: "test" }, {
      credentials: { apiKey: "key" },
      fetchImpl: async () => new Response("null", { headers: { "content-type": "application/json" } }),
      retryBudget: 0,
    }),
    /invalid response.*expected an object/i,
  );
});

test("SDK rejects object responses without a boolean result", async () => {
  for (const body of [{ data: {} }, { result: "true", data: {} }]) {
    await assert.rejects(
      () => callWjxApi({ action: "test" }, {
        credentials: { apiKey: "key" },
        fetchImpl: async () => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }),
        retryBudget: 0,
      }),
      /invalid response.*result must be a boolean/i,
    );
  }
});

test("SDK timeout covers response body parsing after fetch resolves", async () => {
  const hangingResponse = {
    ok: true,
    json: () => new Promise(() => {}),
  };
  const outcome = await Promise.race([
    callWjxApi({ action: "test" }, {
      credentials: { apiKey: "key" },
      fetchImpl: async () => hangingResponse,
      timeoutMs: 10,
      retryBudget: 0,
    }).then(
      () => "resolved",
      (error) => error,
    ),
    new Promise((resolve) => setTimeout(() => resolve("test-timeout"), 150)),
  ]);

  assert.notEqual(outcome, "test-timeout", "response parsing must be bounded by timeoutMs");
  assert.match(String(outcome), /timed out/i);
});

test("SDK timeout also bounds non-2xx response body cleanup", async () => {
  const hangingBody = new ReadableStream({
    cancel: () => new Promise(() => {}),
  });
  const outcome = await Promise.race([
    callWjxApi({ action: "test" }, {
      credentials: { apiKey: "key" },
      fetchImpl: async () => new Response(hangingBody, { status: 503, statusText: "Unavailable" }),
      timeoutMs: 10,
      retryBudget: 0,
    }).then(
      () => "resolved",
      (error) => error,
    ),
    new Promise((resolve) => setTimeout(() => resolve("test-timeout"), 150)),
  ]);

  assert.notEqual(outcome, "test-timeout", "response cleanup must be bounded by timeoutMs");
  assert.match(String(outcome), /timed out/i);
});

test("SDK preserves Error-shaped AbortError from response parsing as a timeout", async () => {
  await assert.rejects(
    () => callWjxApi({ action: "test" }, {
      credentials: { apiKey: "key" },
      fetchImpl: async () => ({
        ok: true,
        json: async () => {
          throw Object.assign(new Error("body aborted"), { name: "AbortError" });
        },
      }),
      timeoutMs: 100,
      retryBudget: 0,
    }),
    /timed out/i,
  );
});
