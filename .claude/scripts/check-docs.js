#!/usr/bin/env node
/** Lightweight documentation consistency checks for CI and pre-commit use. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const childProcess = require("node:child_process");
const { DOCS_DIR, entries } = require("./doc-manifest.js");

const failures = [];
const canonical = new Set(entries.map((entry) => entry.key));
const forbiddenUserDocPhrases = [
  "文档如何维护",
  "维护规则",
  "文档重构",
  "唯一规范来源",
  "构建脚本",
  "提交前运行",
  "不要手工编辑",
  "源码扫描",
  "生成物",
  "修复时",
  "修复过程",
  "过程备注",
  "完整文档维护说明",
];

function collectMarkdown(dir, prefix = "") {
  const result = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) result.push(...collectMarkdown(full, relative));
    else if (name.endsWith(".md")) result.push(relative.slice(0, -3));
  }
  return result;
}

for (const file of collectMarkdown(DOCS_DIR)) {
  if (!canonical.has(file)) failures.push(`orphan Markdown page outside manifest: ${file}.md`);
}

for (const entry of entries) {
  const file = path.join(DOCS_DIR, `${entry.key}.md`);
  if (!fs.existsSync(file)) {
    failures.push(`missing manifest page: ${entry.key}`);
    continue;
  }
  const text = fs.readFileSync(file, "utf8");
  if (/\{\{[A-Z0-9_]+\}\}/.test(text)) {
    failures.push(`${entry.key}: contains unresolved documentation variable`);
  }
  for (const phrase of forbiddenUserDocPhrases) {
    if (text.includes(phrase)) failures.push(`${entry.key}: contains internal process note: ${phrase}`);
  }
  for (const match of text.matchAll(/\]\((?!https?:\/\/|mailto:|#)([^)#]+\.md)(?:#[^)]*)?\)/g)) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(entry.key), match[1])).replace(/^\.\//, "").replace(/\.md$/, "");
    if (!canonical.has(target)) failures.push(`${entry.key}: unresolved canonical link ${match[1]}`);
  }
  const allowsHistoricalExample = entry.key.startsWith("legacy/") || entry.key === "migration" || entry.key === "tasks/configure-client" || entry.key === "tasks/export-responses" || entry.key === "reference/cli" || entry.key === "integrations/workbench";
  if (!allowsHistoricalExample && /--permanent|--base64|--filename|--response_id|wjx-mcp-server@latest/.test(text)) {
    failures.push(`${entry.key}: contains removed command/install path`);
  }
}

for (const file of ["wjx-kit.html", "wjx-kit.fragment.html"]) {
  const full = path.join(DOCS_DIR, file);
  if (!fs.existsSync(full)) failures.push(`missing generated artifact: ${file}`);
  else {
    const text = fs.readFileSync(full, "utf8");
    for (const phrase of forbiddenUserDocPhrases) {
      if (text.includes(phrase)) failures.push(`${file}: contains internal process note: ${phrase}`);
    }
    const sectionCount = file.endsWith("fragment.html")
      ? (text.match(/id="doc-/g) || []).length
      : (text.match(/"id":"doc-/g) || []).length;
    if (sectionCount !== entries.length) failures.push(`${file}: expected ${entries.length} sections, found ${sectionCount}`);
    if (/\{\{[A-Z0-9_]+\}\}/.test(text)) failures.push(`${file}: unresolved documentation variable`);
  }
}

// Rebuild into an isolated directory and compare bytes with the tracked
// artifacts. This keeps `docs:check` read-only from the repository's point of
// view and prevents `docs:build` from masking generated-file drift.
const generatedDir = fs.mkdtempSync(path.join(os.tmpdir(), "wjx-docs-check-"));
try {
  const buildScript = path.join(__dirname, "build-docs-html.js");
  const build = childProcess.spawnSync(process.execPath, [buildScript], {
    cwd: path.join(__dirname, "..", ".."),
    env: { ...process.env, WJX_DOCS_OUTPUT_DIR: generatedDir },
    encoding: "utf8",
  });
  if (build.status !== 0) {
    failures.push(`generated docs build failed: ${(build.stderr || build.stdout || "").trim()}`);
  } else {
    for (const file of ["wjx-kit.html", "wjx-kit.fragment.html"]) {
      const tracked = path.join(DOCS_DIR, file);
      const generated = path.join(generatedDir, file);
      if (!fs.existsSync(generated)) {
        failures.push(`generated docs build did not produce: ${file}`);
      } else if (!fs.existsSync(tracked) || !fs.readFileSync(tracked).equals(fs.readFileSync(generated))) {
        failures.push(`${file}: generated artifact is stale; run npm run docs:build`);
      }
    }
  }
} finally {
  fs.rmSync(generatedDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Documentation checks passed (${entries.length} canonical pages).`);
