import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "../..");
const artifacts = ["wjx-kit.html", "wjx-kit.fragment.html"];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "wjx-docs-portability-"));
  for (const relative of [
    ".claude/scripts/build-docs-html.js",
    ".claude/scripts/check-docs.js",
    ".claude/scripts/doc-manifest.js",
    "wjx-mcp-server/package.json",
    "wjx-mcp-server/src",
    "wjx-cli/src",
    "node_modules/marked",
  ]) cpSync(join(root, relative), join(directory, relative), { recursive: true });
  cpSync(join(root, "wjx-docs"), join(directory, "wjx-docs"), {
    recursive: true,
    filter: (source) => statSync(source).isDirectory() || source.endsWith(".md"),
  });
  return directory;
}

function markdownNewlines(directory, newline) {
  for (const name of readdirSync(directory)) {
    const file = join(directory, name);
    if (statSync(file).isDirectory()) markdownNewlines(file, newline);
    else if (name.endsWith(".md")) {
      writeFileSync(file, readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/\n/g, newline));
    }
  }
}

function run(directory, script, outputDirectory = "") {
  return spawnSync(process.execPath, [join(directory, ".claude/scripts", script)], {
    cwd: directory,
    env: { ...process.env, WJX_DOCS_OUTPUT_DIR: outputDirectory },
    encoding: "utf8",
    timeout: 30_000,
  });
}

test("documentation artifacts are identical for LF and CRLF Markdown sources", () => {
  const directory = fixture();
  try {
    const docs = join(directory, "wjx-docs");
    const lf = join(directory, "output-lf");
    const crlf = join(directory, "output-crlf");
    markdownNewlines(docs, "\n");
    const lfBuild = run(directory, "build-docs-html.js", lf);
    assert.equal(lfBuild.status, 0, lfBuild.stderr);
    markdownNewlines(docs, "\r\n");
    const crlfBuild = run(directory, "build-docs-html.js", crlf);
    assert.equal(crlfBuild.status, 0, crlfBuild.stderr);
    for (const file of artifacts) {
      assert.equal(digest(readFileSync(join(lf, file))), digest(readFileSync(join(crlf, file))), file);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("documentation checks accept checkout newlines, remain read-only, and detect content drift", () => {
  const directory = fixture();
  try {
    const docs = join(directory, "wjx-docs");
    markdownNewlines(docs, "\n");
    const build = run(directory, "build-docs-html.js", docs);
    assert.equal(build.status, 0, build.stderr);
    for (const file of artifacts) {
      const path = join(docs, file);
      writeFileSync(path, readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
    }
    const before = artifacts.map((file) => digest(readFileSync(join(docs, file))));
    const check = run(directory, "check-docs.js");
    assert.equal(check.status, 0, check.stderr);
    assert.deepEqual(artifacts.map((file) => digest(readFileSync(join(docs, file)))), before);
    const html = join(docs, artifacts[0]);
    writeFileSync(html, `${readFileSync(html, "utf8")}\n<!-- stale content -->\n`);
    const drift = run(directory, "check-docs.js");
    assert.equal(drift.status, 1);
    assert.match(drift.stderr, /generated artifact is stale/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
