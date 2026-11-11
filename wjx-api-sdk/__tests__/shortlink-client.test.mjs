import assert from "node:assert/strict";
import { test } from "node:test";

import { getShortLink, getWjxShortLinkUrl } from "../dist/index.js";

const credentials = { apiKey: "test-key" };

test("getShortLink encodes long survey URLs and preserves the upstream success response", async () => {
  const longUrl = "https://drunkyong.natapp4.cc/vm/PJn0P.aspx?sojumpparm=234&parmsign=c8432440b620eb9abd32fa46cf11f19845f5508f";
  let request;
  const result = await getShortLink(
    { url: longUrl },
    credentials,
    async (input, init) => {
      request = { url: String(input), init };
      return new Response(JSON.stringify({ success: true, msg: null, data: "https://drunkyong.natapp4.cc/s/jv" }), {
        headers: { "content-type": "application/json" },
      });
    },
  );

  assert.deepEqual(result, { success: true, msg: null, data: "https://drunkyong.natapp4.cc/s/jv" });
  const requestUrl = new URL(request.url);
  assert.equal(requestUrl.pathname, "/openapi/shortlink.aspx");
  assert.equal(requestUrl.searchParams.get("url"), longUrl);
  assert.match(requestUrl.search, /url=https%3A%2F%2Fdrunkyong\.natapp4\.cc%2Fvm%2FPJn0P\.aspx%3F/);
  assert.equal(request.init.method, "GET");
  assert.equal(request.init.headers.Authorization, "Bearer test-key");
});

test("getShortLink accepts official survey hosts and custom survey paths", async () => {
  for (const url of [
    "https://www.wjx.cn/vm/w4GZh.aspx",
    "https://www.wjx.cn/m/w4GZh.aspx?source=sms",
    "https://www.wjx.cn/jq/w4GZh.aspx",
    "https://custom.example.test/vm/w4GZh.aspx?source=sms",
  ]) {
    const result = await getShortLink(
      { url },
      undefined,
      async () => new Response(JSON.stringify({ success: true, msg: null, data: "https://www.wjx.cn/s/x" })),
    );
    assert.equal(result.success, true);
  }
});

test("getShortLink rejects blank, malformed, and non-survey URLs before transport", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response("never");
  };
  for (const url of ["", "   ", "not a URL", "https://example.com/landing", "https://www.wjx.cn/s/jv"]) {
    await assert.rejects(
      () => getShortLink({ url }, credentials, fetchImpl),
      /url.*(required|URL|问卷)/i,
    );
  }
  assert.equal(calls, 0);
});

test("getShortLink returns upstream business failures without changing success semantics", async () => {
  const response = await getShortLink(
    { url: "https://www.wjx.cn/vm/w4GZh.aspx" },
    credentials,
    async () => new Response(JSON.stringify({ success: false, msg: "无效问卷地址", data: null })),
  );
  assert.deepEqual(response, { success: false, msg: "无效问卷地址", data: null });
});

test("getShortLink rejects HTTP, malformed, and invalid upstream responses", async () => {
  const url = { url: "https://www.wjx.cn/vm/w4GZh.aspx" };
  await assert.rejects(
    () => getShortLink(url, credentials, async () => new Response("bad gateway", { status: 502, statusText: "Bad Gateway" })),
    /shortlink.*502/i,
  );
  await assert.rejects(
    () => getShortLink(url, credentials, async () => new Response("not json")),
    /shortlink.*JSON/i,
  );
  await assert.rejects(
    () => getShortLink(url, credentials, async () => new Response(JSON.stringify({ success: "yes", data: "x" }))),
    /shortlink.*success/i,
  );
  await assert.rejects(
    () => getShortLink(url, credentials, async () => new Response(JSON.stringify({ success: true, data: 123 }))),
    /shortlink.*data/i,
  );
});

test("getWjxShortLinkUrl supports explicit base URL and endpoint override", () => {
  assert.equal(getWjxShortLinkUrl("https://tenant.example"), "https://tenant.example/openapi/shortlink.aspx");
});

test("getShortLink ignores a blank request base URL and keeps the credential profile route", async () => {
  let requestedUrl;
  await getShortLink(
    { url: "https://www.wjx.cn/vm/w4GZh.aspx" },
    { apiKey: "test-key", baseUrl: "https://profile.example" },
    async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ success: true, msg: null, data: "https://profile.example/s/x" }));
    },
    { baseUrl: "   " },
  );
  assert.match(requestedUrl, /^https:\/\/profile\.example\/openapi\/shortlink\.aspx\?/);
});

test("getShortLink releases a non-2xx response body before throwing", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("temporary failure"));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    () => getShortLink(
      { url: "https://www.wjx.cn/vm/w4GZh.aspx" },
      undefined,
      async () => new Response(body, { status: 503, statusText: "Unavailable" }),
    ),
    /shortlink.*503/i,
  );
  assert.equal(cancelled, true);
});

test("getShortLink bounds response parsing by timeoutMs", async () => {
  const outcome = await Promise.race([
    getShortLink(
      { url: "https://www.wjx.cn/vm/w4GZh.aspx" },
      undefined,
      async () => ({
        ok: true,
        json: () => new Promise(() => {}),
      }),
      { timeoutMs: 10 },
    ).then(
      () => "resolved",
      (error) => error,
    ),
    new Promise((resolve) => setTimeout(() => resolve("test-timeout"), 150)),
  ]);

  assert.notEqual(outcome, "test-timeout", "shortlink response parsing must be bounded by timeoutMs");
  assert.match(String(outcome), /timed out/i);
});

test("getShortLink rejects timeout values that overflow the Node timer range", async () => {
  let calls = 0;
  await assert.rejects(
    () => getShortLink(
      { url: "https://www.wjx.cn/vm/w4GZh.aspx" },
      undefined,
      async () => {
        calls += 1;
        return new Response(JSON.stringify({ success: true, data: "https://www.wjx.cn/s/x" }));
      },
      { timeoutMs: 2_147_483_648 },
    ),
    /timeoutMs.*(?:integer|finite|positive|between|range)/i,
  );
  assert.equal(calls, 0);
});
