import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLatestVersion } from "../dist/core/version-check.js";

test("version check releases non-2xx registry response bodies", async () => {
  const previous = process.env.WJX_DISABLE_VERSION_CHECK;
  delete process.env.WJX_DISABLE_VERSION_CHECK;
  let cancelled = false;
  try {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("temporary failure"));
      },
      cancel() {
        cancelled = true;
      },
    });
    checkLatestVersion(async () => new Response(body, { status: 503, statusText: "Service Unavailable" }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(cancelled, true);
  } finally {
    if (previous === undefined) delete process.env.WJX_DISABLE_VERSION_CHECK;
    else process.env.WJX_DISABLE_VERSION_CHECK = previous;
  }
});

test("version check treats a synchronous fetch failure as a best-effort miss", async () => {
  const previous = process.env.WJX_DISABLE_VERSION_CHECK;
  delete process.env.WJX_DISABLE_VERSION_CHECK;
  try {
    assert.doesNotThrow(() => {
      checkLatestVersion(() => {
        throw new Error("registry unavailable");
      });
    });
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    if (previous === undefined) delete process.env.WJX_DISABLE_VERSION_CHECK;
    else process.env.WJX_DISABLE_VERSION_CHECK = previous;
  }
});

test("version check timer is unrefed when a registry fetch ignores abort", async () => {
  const previousDisabled = process.env.WJX_DISABLE_VERSION_CHECK;
  const originalSetTimeout = globalThis.setTimeout;
  let unrefCalled = false;
  delete process.env.WJX_DISABLE_VERSION_CHECK;
  globalThis.setTimeout = ((handler, delay, ...args) => {
    const timer = originalSetTimeout(handler, delay, ...args);
    const originalUnref = timer.unref.bind(timer);
    timer.unref = () => {
      unrefCalled = true;
      return originalUnref();
    };
    return timer;
  });
  try {
    checkLatestVersion(() => new Promise(() => {}));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(unrefCalled, true);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    if (previousDisabled === undefined) delete process.env.WJX_DISABLE_VERSION_CHECK;
    else process.env.WJX_DISABLE_VERSION_CHECK = previousDisabled;
  }
});
