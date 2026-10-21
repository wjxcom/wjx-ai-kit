import test from "node:test";
import assert from "node:assert/strict";
import { getCommandMetadata } from "../dist/lib/command-metadata.js";

test("root diagnostics commands resolve their declared read metadata", () => {
  for (const command of ["whoami", "doctor"]) {
    const metadata = getCommandMetadata(command);
    assert.equal(metadata.risk, "read", `${command} should be read-only`);
    assert.deepEqual(metadata.identities, ["user", "bot"], `${command} should accept user/bot identities`);
  }
});
