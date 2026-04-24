#!/usr/bin/env node
/**
 * build-docs-fragment.js — 生成 wangEditor / CMS 可粘贴的 HTML 片段
 *
 * 输出: wjx-docs/wjx-kit.fragment.html
 *
 * 特点:
 *  - 无 <html>/<head>/<body> 外壳
 *  - 无 <script>（所有 markdown 已在 Node 端预渲染）
 *  - <style> 块 + 关键元素 inline style 双保险（防止 <style> 被 CMS 剥离）
 *  - 所有文档按菜单顺序拼接为单页，顶部 TOC 用锚点跳转
 */

const { readFileSync, writeFileSync, readdirSync } = require("fs");
const { join, basename } = require("path");
const { marked } = require("marked");

const ROOT = join(__dirname, "../..");
const DOCS_DIR = join(ROOT, "wjx-docs");
const OUTPUT = join(DOCS_DIR, "wjx-kit.fragment.html");

const MCP_PKG = require("../../wjx-mcp-server/package.json");
const DOC_VARS = {
  MCP_TOOL_COUNT: "57",
  MCP_RESOURCE_COUNT: "8",
  MCP_PROMPT_COUNT: "19",
  CLI_COMMAND_COUNT: "69",
  CLI_ANALYTICS_COUNT: "6",
  SDK_FUNCTION_COUNT: "60+",
  VERSION: MCP_PKG.version,
};

const MENU = [
  { group: "总览", items: [{ key: "00-overview", label: "总纲" }] },
  {
    group: "入门指南",
    items: [
      { key: "mcp-getting-started", label: "MCP Server 入门" },
      { key: "cli-getting-started", label: "CLI 入门" },
      { key: "sdk-getting-started", label: "SDK 入门" },
      { key: "skill-getting-started", label: "Skill 包入门" },
    ],
  },
  {
    group: "进阶指南",
    items: [
      { key: "mcp-advanced", label: "MCP Server 进阶" },
      { key: "cli-advanced", label: "CLI 进阶" },
      { key: "sdk-advanced", label: "SDK 进阶" },
    ],
  },
  {
    group: "AI 工具配置",
    items: [
      { key: "setup-claude-code", label: "Claude Code" },
      { key: "setup-claude-desktop", label: "Claude Desktop" },
      { key: "setup-ide", label: "IDE 插件" },
      { key: "setup-claw", label: "Claw 系列" },
      { key: "setup-workbench", label: "AI 工作台" },
    ],
  },
];

// 读取 + 注入变量
const docs = {};
for (const file of readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"))) {
  const key = basename(file, ".md");
  let content = readFileSync(join(DOCS_DIR, file), "utf-8");
  for (const [name, val] of Object.entries(DOC_VARS)) {
    content = content.split(`{{${name}}}`).join(val);
  }
  docs[key] = content;
}

// 自定义 renderer：内部 md 链接改成锚点 + 关键元素加 inline style
const renderer = new marked.Renderer();

const INLINE = {
  h1: "font-size:24px;color:#222;margin:14px 0 10px;padding-bottom:8px;border-bottom:2px solid #f0f0f0;",
  h2: "font-size:20px;color:#222;margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid #f0f0f0;",
  h3: "font-size:17px;color:#333;margin:14px 0 6px;",
  h4: "font-size:15px;color:#444;margin:12px 0 4px;",
  p: "margin:0 0 8px;line-height:1.7;",
  a: "color:#1890ff;text-decoration:none;",
  ul: "margin:0 0 8px;padding-left:24px;",
  ol: "margin:0 0 8px;padding-left:24px;",
  li: "margin:2px 0;",
  blockquote:
    "margin:0 0 10px;padding:8px 12px;border-left:4px solid #1890ff;background:#f6f8fa;color:#555;",
  hr: "border:none;border-top:1px solid #e8e8e8;margin:14px 0;",
  code: "font-family:SFMono-Regular,Consolas,Menlo,monospace;font-size:13px;background:#f6f8fa;padding:2px 6px;border-radius:3px;",
  pre: "background:#f6f8fa;border:1px solid #e8e8e8;border-radius:6px;padding:12px;overflow-x:auto;margin:0 0 10px;font-family:SFMono-Regular,Consolas,Menlo,monospace;font-size:13px;line-height:1.5;white-space:pre;",
  preCode: "background:none;padding:0;font-size:13px;white-space:pre;",
  table: "width:100%;border-collapse:collapse;margin:0 0 10px;font-size:14px;",
  th: "border:1px solid #e8e8e8;padding:6px 10px;text-align:left;background:#fafafa;font-weight:600;",
  td: "border:1px solid #e8e8e8;padding:6px 10px;text-align:left;",
};

renderer.heading = ({ tokens, depth }) => {
  const text = renderer.parser.parseInline(tokens);
  const style = INLINE[`h${depth}`] || "";
  return `<h${depth} style="${style}">${text}</h${depth}>\n`;
};
renderer.paragraph = ({ tokens }) =>
  `<p style="${INLINE.p}">${renderer.parser.parseInline(tokens)}</p>\n`;
renderer.link = ({ href, title, tokens }) => {
  const text = renderer.parser.parseInline(tokens);
  let finalHref = href;
  const m = typeof href === "string" && href.match(/^\.?\/?([-\w]+)\.md$/);
  if (m && docs[m[1]]) {
    finalHref = `#doc-${m[1]}`;
  }
  const titleAttr = title ? ` title="${title}"` : "";
  const externalAttr = finalHref.startsWith("#")
    ? ""
    : ' target="_blank" rel="noopener"';
  return `<a href="${finalHref}" style="${INLINE.a}"${titleAttr}${externalAttr}>${text}</a>`;
};
renderer.list = ({ ordered, items }) => {
  const tag = ordered ? "ol" : "ul";
  const body = items
    .map(
      (it) =>
        `<li style="${INLINE.li}">${renderer.parser.parse(it.tokens).replace(/<p style="[^"]*">/g, "").replace(/<\/p>/g, "")}</li>`,
    )
    .join("\n");
  return `<${tag} style="${INLINE[tag]}">\n${body}\n</${tag}>\n`;
};
renderer.blockquote = ({ tokens }) =>
  `<blockquote style="${INLINE.blockquote}">${renderer.parser.parse(tokens)}</blockquote>\n`;
renderer.hr = () => `<hr style="${INLINE.hr}">\n`;
renderer.codespan = ({ text }) => `<code style="${INLINE.code}">${text}</code>`;
renderer.code = ({ text }) => {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre style="${INLINE.pre}"><code style="${INLINE.preCode}">${escaped}</code></pre>\n`;
};
renderer.table = ({ header, rows }) => {
  const th = header
    .map((c) => `<th style="${INLINE.th}">${renderer.parser.parseInline(c.tokens)}</th>`)
    .join("");
  const trs = rows
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td style="${INLINE.td}">${renderer.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`,
    )
    .join("\n");
  return `<table style="${INLINE.table}"><thead><tr>${th}</tr></thead><tbody>\n${trs}\n</tbody></table>\n`;
};

marked.setOptions({ renderer, gfm: true, breaks: false });

// 渲染每个文档
const sections = [];
for (const group of MENU) {
  for (const item of group.items) {
    const md = docs[item.key];
    if (!md) {
      console.warn(`缺失文档: ${item.key}`);
      continue;
    }
    const html = marked.parse(md);
    sections.push(
      `<section id="doc-${item.key}" style="margin-bottom:48px;padding-top:20px;">\n${html}\n</section>\n<hr style="${INLINE.hr}">`,
    );
  }
}

// TOC
const tocItems = MENU.map((g) => {
  const lis = g.items
    .map(
      (it) =>
        `<li style="${INLINE.li}"><a href="#doc-${it.key}" style="${INLINE.a}">${it.label}</a></li>`,
    )
    .join("");
  return `<li style="margin:6px 0;"><strong style="color:#666;font-size:13px;">${g.group}</strong><ul style="${INLINE.ul};margin-top:4px;">${lis}</ul></li>`;
}).join("\n");

const TOC = `<nav class="wjx-docs-toc" style="background:#fafbfc;border:1px solid #e8e8e8;border-radius:8px;padding:16px 20px;margin:0 0 32px;">
<h3 style="margin:0 0 10px;font-size:16px;color:#222;">文档导航</h3>
<ul style="list-style:none;padding-left:0;margin:0;">
${tocItems}
</ul>
</nav>`;

// 片段 <style>（能保留最好，被剥了也有 inline 兜底）
const STYLE = `<style>
.wjx-docs-frag { max-width: 960px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.7; color: #333; }
.wjx-docs-frag a:hover { text-decoration: underline; }
.wjx-docs-frag tr:nth-child(even) td { background: #fafbfc; }
.wjx-docs-frag img { max-width: 100%; border-radius: 4px; }
.wjx-docs-frag .wjx-docs-toc a { display: inline-block; padding: 2px 0; }
</style>`;

const fragment = `<!-- wjx-ai-kit 文档 · v${DOC_VARS.VERSION} · fragment for CMS/wangEditor -->
${STYLE}
<div class="wjx-docs-frag">
${TOC}
${sections.join("\n")}
</div>
`;

// 压掉标签之间的空白（wangEditor 会把这些换行渲染成空行）
// 保护 <pre>...</pre> 里的内容不受影响
const preBlocks = [];
const protected1 = fragment.replace(/<pre[\s\S]*?<\/pre>/g, (m) => {
  preBlocks.push(m);
  return ` PRE${preBlocks.length - 1} `;
});
const squashed = protected1.replace(/>\s+</g, "><").replace(/\n+/g, "\n");
const finalOutput = squashed.replace(/ PRE(\d+) /g, (_, i) => preBlocks[Number(i)]);

writeFileSync(OUTPUT, finalOutput, "utf-8");

const sizeKB = (Buffer.byteLength(finalOutput, "utf-8") / 1024).toFixed(1);
console.log(`生成完成: ${OUTPUT} (${sizeKB} KB)`);
console.log(`包含 ${sections.length} 篇文档`);
