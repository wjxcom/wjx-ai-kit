import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const CLI = resolve(packageRoot, "dist", "index.js");
const E2E_ENABLED = process.env.WJX_E2E === "1";
const COMMAND_TIMEOUT_MS = 90_000;

function runCli(args) {
  return new Promise((resolveRun) => {
    execFile(process.execPath, [CLI, ...args], {
      cwd: packageRoot,
      env: { ...process.env },
      encoding: "utf8",
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 2 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      resolveRun({
        code: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
        stdout: stdout || "",
        stderr: stderr || "",
      });
    });
  });
}

function successfulData(result, label) {
  assert.equal(result.code, 0, `${label} failed (exit ${String(result.code)})`);
  let envelope;
  try {
    envelope = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error(`${label} returned non-JSON output`);
  }
  assert.equal(envelope?.ok, true, `${label} returned an unsuccessful result`);
  return envelope.data;
}

function numericId(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value);
  return undefined;
}

function firstSurveyId(value) {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstSurveyId(item);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  const record = value;
  for (const key of ["vid", "activity_id", "activityid"]) {
    const found = numericId(record[key]);
    if (found !== undefined) return found;
  }

  for (const [key, child] of Object.entries(record)) {
    if (key === "activitys" || key === "activities") {
      if (child && typeof child === "object" && !Array.isArray(child)) {
        for (const [activityId, activity] of Object.entries(child)) {
          const found = firstSurveyId(activity) ?? numericId(activityId);
          if (found !== undefined) return found;
        }
      }
      continue;
    }
    if (child && typeof child === "object") {
      const found = firstSurveyId(child);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

test("real API read-only smoke is opt-in through WJX_E2E=1", {
  skip: !E2E_ENABLED,
}, async (t) => {
  // This branch deliberately exercises reads only. Writes require a separate
  // explicitly reviewed test and are never enabled by WJX_E2E alone.
  successfulData(await runCli(["doctor"]), "doctor");
  const listed = successfulData(
    await runCli(["survey", "list", "--page", "1", "--page_size", "5"]),
    "survey list",
  );

  const configuredVid = process.env.WJX_E2E_VID?.trim();
  const vid = configuredVid ? numericId(configuredVid) : firstSurveyId(listed);
  if (configuredVid && vid === undefined) {
    throw new Error("WJX_E2E_VID must be a positive integer");
  }
  if (vid === undefined) {
    t.skip("No survey was returned; set WJX_E2E_VID to exercise detail and response reads");
    return;
  }

  successfulData(await runCli(["survey", "get", "--vid", String(vid)]), "survey get");
  successfulData(await runCli(["response", "count", "--vid", String(vid)]), "response count");
  successfulData(
    await runCli([
      "response", "query", "--vid", String(vid), "--page_index", "1", "--page_size", "2",
    ]),
    "response query",
  );
});
