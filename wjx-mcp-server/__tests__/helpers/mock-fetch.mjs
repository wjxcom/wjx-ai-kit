import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Creates a mock fetch that returns a JSON response.
 * @param {object} json - The JSON response body
 * @param {number} [status=200] - HTTP status code
 * @returns {{ fetch: Function, lastCall: () => { url: string, init: object, body: object } }}
 */
export function createMockFetch(json = { result: true }, status = 200) {
  let lastUrl, lastInit;
  const fetch = async (url, init) => {
    lastUrl = url;
    lastInit = init;
    return new Response(JSON.stringify(json), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return {
    fetch,
    lastCall: () => ({
      url: lastUrl,
      init: lastInit,
      body: lastInit ? JSON.parse(lastInit.body) : undefined,
    }),
  };
}

/**
 * Creates a mock fetch that throws a network error.
 */
export function createFailingFetch(errorMessage = "Network error") {
  return async () => {
    throw new TypeError(errorMessage);
  };
}

/**
 * Creates a mock fetch that returns sequential responses.
 */
export function createSequentialFetch(responses) {
  let callIndex = 0;
  return async (url, init) => {
    const resp = responses[callIndex++] ?? responses[responses.length - 1];
    return new Response(JSON.stringify(resp.json ?? { result: true }), {
      status: resp.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

// ─── Self-tests ──────────────────────────────────────────────────────────────

describe("createMockFetch", () => {
  it("should return a Response with the given JSON body", async () => {
    const { fetch } = createMockFetch({ hello: "world" });
    const res = await fetch("https://example.com", { method: "POST", body: '{"a":1}' });
    const data = await res.json();
    assert.deepEqual(data, { hello: "world" });
    assert.equal(res.status, 200);
  });

  it("should capture the last call url and init", async () => {
    const { fetch, lastCall } = createMockFetch({ ok: true });
    await fetch("https://api.test/v1", { method: "POST", body: '{"x":42}' });
    const call = lastCall();
    assert.equal(call.url, "https://api.test/v1");
    assert.equal(call.init.method, "POST");
    assert.deepEqual(call.body, { x: 42 });
  });

  it("should return custom status code", async () => {
    const { fetch } = createMockFetch({ error: true }, 400);
    const res = await fetch("https://example.com");
    assert.equal(res.status, 400);
  });

  it("should default to { result: true } and status 200", async () => {
    const { fetch } = createMockFetch();
    const res = await fetch("https://example.com");
    const data = await res.json();
    assert.deepEqual(data, { result: true });
    assert.equal(res.status, 200);
  });
});

describe("createFailingFetch", () => {
  it("should throw a TypeError with given message", async () => {
    const fetch = createFailingFetch("connection refused");
    await assert.rejects(() => fetch("https://x.com"), {
      name: "TypeError",
      message: "connection refused",
    });
  });

  it("should default to 'Network error'", async () => {
    const fetch = createFailingFetch();
    await assert.rejects(() => fetch("https://x.com"), {
      message: "Network error",
    });
  });
});

describe("createSequentialFetch", () => {
  it("should return responses in order", async () => {
    const fetch = createSequentialFetch([
      { json: { step: 1 }, status: 200 },
      { json: { step: 2 }, status: 201 },
    ]);

    const r1 = await fetch("https://example.com");
    assert.equal(r1.status, 200);
    assert.deepEqual(await r1.json(), { step: 1 });

    const r2 = await fetch("https://example.com");
    assert.equal(r2.status, 201);
    assert.deepEqual(await r2.json(), { step: 2 });
  });

  it("should repeat last response when exhausted", async () => {
    const fetch = createSequentialFetch([{ json: { only: true }, status: 200 }]);

    await fetch("https://example.com");
    const r2 = await fetch("https://example.com");
    assert.deepEqual(await r2.json(), { only: true });
  });

  it("should default to { result: true } and 200 when fields missing", async () => {
    const fetch = createSequentialFetch([{}]);
    const res = await fetch("https://example.com");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { result: true });
  });
});
