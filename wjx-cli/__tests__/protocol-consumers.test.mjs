import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { scanProtocolConsumers } from "../scripts/lib/protocol-scan.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("active protocol consumers do not teach the legacy result envelope", () => {
  const findings = scanProtocolConsumers(ROOT);
  assert.deepEqual(findings, [], findings.map((item) => `${item.file}:${item.line}`).join("\n"));
});
