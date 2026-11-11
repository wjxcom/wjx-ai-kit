import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCK_MODULE = pathToFileURL(resolve(__dirname, "..", "scripts", "build-lock.mjs")).href;

function runLockChild({ lockPath, markerPath, label, holdMs }) {
  const source = `
    import { appendFileSync } from "node:fs";
    import { setTimeout as sleep } from "node:timers/promises";
    import { withBuildLock } from ${JSON.stringify(LOCK_MODULE)};
    await withBuildLock(async () => {
      const start = Date.now();
      appendFileSync(process.env.WJX_LOCK_MARKER, JSON.stringify({ label: process.env.WJX_LOCK_LABEL, event: "start", at: start }) + "\\n");
      await sleep(Number(process.env.WJX_LOCK_HOLD_MS));
      const end = Date.now();
      appendFileSync(process.env.WJX_LOCK_MARKER, JSON.stringify({ label: process.env.WJX_LOCK_LABEL, event: "end", at: end }) + "\\n");
    }, { lockPath: process.env.WJX_LOCK_PATH, timeoutMs: 5000, pollMs: 10 });
  `;
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
      cwd: resolve(__dirname, ".."),
      env: {
        ...process.env,
        WJX_LOCK_PATH: lockPath,
        WJX_LOCK_MARKER: markerPath,
        WJX_LOCK_LABEL: label,
        WJX_LOCK_HOLD_MS: String(holdMs),
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => resolveRun({ code, signal, stderr }));
  });
}

test("independent processes enter the build lock serially", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "wjx-build-lock-test-"));
  try {
    const lockPath = join(tempRoot, "lock");
    const markerPath = join(tempRoot, "events.jsonl");
    const first = runLockChild({ lockPath, markerPath, label: "first", holdMs: 180 });
    await new Promise((resolveWait) => setTimeout(resolveWait, 40));
    const second = runLockChild({ lockPath, markerPath, label: "second", holdMs: 20 });
    const results = await Promise.all([first, second]);
    assert.deepEqual(results.map((result) => result.code), [0, 0], results.map((result) => result.stderr).join("\n"));

    const events = (await readFile(markerPath, "utf8"))
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(events.length, 4);
    const intervals = new Map();
    for (const event of events) {
      const interval = intervals.get(event.label) ?? {};
      interval[event.event] = event.at;
      intervals.set(event.label, interval);
    }
    assert.equal(intervals.size, 2);
    const [a, b] = [...intervals.values()];
    assert.ok(a.end <= b.start || b.end <= a.start, JSON.stringify(intervals));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("stale locks are recovered and active locks time out", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "wjx-build-lock-test-"));
  try {
    const lockPath = join(tempRoot, "lock");
    await mkdir(lockPath);
    await writeFile(join(lockPath, "owner.json"), JSON.stringify({ pid: 99999999, command: "dead" }));

    const { withBuildLock } = await import("../scripts/build-lock.mjs");
    let recovered = false;
    await withBuildLock(async () => { recovered = true; }, { lockPath, timeoutMs: 500, pollMs: 10 });
    assert.equal(recovered, true);

    await mkdir(lockPath);
    await writeFile(join(lockPath, "owner.json"), JSON.stringify({ pid: process.pid, command: "test" }));
    await assert.rejects(
      withBuildLock(async () => {}, { lockPath, timeoutMs: 100, pollMs: 10 }),
      /Timed out waiting for CLI build lock held by pid/,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
