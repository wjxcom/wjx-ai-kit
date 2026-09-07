import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

test("core skill installer fails closed when wjx version probing fails", async () => {
  const source = await readFile(resolve(ROOT, "..", "wjx-skills", "wjx-cli-use", "setup.sh"), "utf8");
  assert.match(source, /if ! WJX_VERSION=/);
  assert.match(source, /wjx --version/);
  assert.doesNotMatch(source, /wjx --version[^\n]*\|\| true/);
});

test("skill installers validate a non-empty API key instead of file presence alone", async () => {
  const core = await readFile(resolve(ROOT, "..", "wjx-skills", "wjx-cli-use", "setup.sh"), "utf8");
  const ppt = await readFile(resolve(ROOT, "..", "wjx-skills", "wjx-survey-ppt", "setup.sh"), "utf8");
  for (const source of [core, ppt]) {
    assert.match(source, /has_nonblank\(\)/);
    assert.match(source, /config_has_api_key\(\)/);
    assert.match(source, /value\.apiKey.*trim\(\)/s);
  }
  assert.doesNotMatch(core, /-f \"\$CONFIG_PATH\"\)/);
  assert.doesNotMatch(ppt, /-f \"\$config_path\"\)/);
});

test("atomic installer preserves transaction roots when a backup cannot be restored", async () => {
  const source = await readFile(resolve(ROOT, "src", "lib", "install-transaction.ts"), "utf8");
  assert.match(source, /const backupsRemain = staged\.some\(\(entry\) => pathExists\(entry\.backupPath\)\)/);
  assert.match(source, /if \(rollbackErrors\.length > 0 \|\| backupsRemain\)/);
});

test("shell installer distinguishes stale PATH from a missing runtime", async () => {
  const source = await readFile(resolve(ROOT, "..", "wjx-skills", "wjx-cli-use", "setup.sh"), "utf8");
  assert.match(source, /resolve_node_bin\(\)/);
  assert.match(source, /where\.exe/);
  assert.match(source, /Program Files\/nodejs\/node\.exe/);
  assert.match(source, /resolve_npm_bin\(\)/);
  assert.match(source, /resolve_wjx_bin\(\)/);
  assert.match(source, /PATH 未刷新/);
  assert.match(source, /"\$NODE_BIN" --version/);
  assert.match(source, /node_modules\/wjx-cli\/dist\/index\.js/);
  assert.match(source, /"\$NPM_BIN" install -g wjx-cli@latest/);
  assert.doesNotMatch(source, /(?:^|\n)\s*winget install OpenJS\.NodeJS/m);
});
