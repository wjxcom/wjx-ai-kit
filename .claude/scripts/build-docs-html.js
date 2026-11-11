#!/usr/bin/env node
/** Build both generated documentation artifacts from the Markdown manifest. */
const fs = require("node:fs");
const path = require("node:path");
const { marked } = require("marked");
const { ROOT, DOCS_DIR, MANIFEST, entries } = require("./doc-manifest.js");

// CI can direct generation to a temporary directory so consistency checks do
// not overwrite tracked artifacts while comparing the canonical Markdown.
const outputDir = process.env.WJX_DOCS_OUTPUT_DIR
  ? path.resolve(process.env.WJX_DOCS_OUTPUT_DIR)
  : DOCS_DIR;
fs.mkdirSync(outputDir, { recursive: true });
const outputHtml = path.join(outputDir, "wjx-kit.html");
const outputFragment = path.join(outputDir, "wjx-kit.fragment.html");

function readTree(dir) {
  const result = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) result.push(readTree(full));
    else if (name.endsWith(".ts")) result.push(fs.readFileSync(full, "utf8"));
  }
  return result.join("\n");
}

function count(pattern, dir) {
  return (readTree(dir).match(pattern) || []).length;
}

const mcpSource = path.join(ROOT, "wjx-mcp-server", "src");
const cliSource = path.join(ROOT, "wjx-cli", "src");
const mcpPackage = JSON.parse(fs.readFileSync(path.join(ROOT, "wjx-mcp-server", "package.json"), "utf8"));
const vars = {
  MCP_TOOL_COUNT: count(/server\.registerTool\s*\(/g, mcpSource),
  MCP_RESOURCE_COUNT: count(/server\.resource\s*\(/g, mcpSource),
  MCP_PROMPT_COUNT: count(/server\.prompt\s*\(/g, mcpSource),
  // Top-level registrations are not user-facing leaf commands.
  CLI_COMMAND_COUNT: count(/\.command\s*\(/g, cliSource) - count(/program\.command\s*\(/g, cliSource),
  VERSION: mcpPackage.version,
};

const keyToId = (key) => `doc-${key.replace(/\//g, "--")}`;
const keySet = new Set(entries.map((entry) => entry.key));

function injectVars(text) {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, name) => String(vars[name] ?? `{{${name}}}`));
}

function normalizeLinks(markdown, fromKey) {
  const fromDir = path.posix.dirname(fromKey);
  return markdown.replace(/\]\((?!https?:\/\/|mailto:|#)([^)]+)\)/g, (whole, rawTarget) => {
    const match = rawTarget.match(/^([^#]+?)(#.*)?$/);
    if (!match || !match[1].endsWith(".md")) return whole;
    const target = path.posix.normalize(path.posix.join(fromDir, match[1])).replace(/^\.\//, "").replace(/\.md$/, "");
    if (!keySet.has(target)) return whole;
    return `](#${keyToId(target)}${match[2] || ""})`;
  });
}

const docs = {};
for (const entry of entries) {
  const file = path.join(DOCS_DIR, `${entry.key}.md`);
  if (!fs.existsSync(file)) throw new Error(`Manifest page missing: ${entry.key}`);
  docs[entry.key] = normalizeLinks(injectVars(fs.readFileSync(file, "utf8")), entry.key);
}

const menu = MANIFEST.map((group) => ({
  group: group.group,
  collapsed: Boolean(group.collapsed),
  items: group.items.map(([key, label]) => ({ key, label, id: keyToId(key) })),
}));

const docsJson = JSON.stringify(docs).replace(/</g, "\\u003c");
const menuJson = JSON.stringify(menu);

const htmlTemplate = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>wjx-ai-kit 文档</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github.min.css">
<style>
.wjx-docs-root{display:flex;gap:24px;max-width:1200px;margin:0 auto;padding:0 16px;font:15px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;color:#333}.wjx-docs-root *{box-sizing:border-box}.wjx-docs-content{flex:1;min-width:0;padding-bottom:48px}.wjx-docs-content h1{font-size:28px;color:#222;margin:0 0 16px;padding-bottom:12px;border-bottom:2px solid #f0f0f0}.wjx-docs-content h2{font-size:22px;color:#222;margin:32px 0 12px;padding-bottom:8px;border-bottom:1px solid #f0f0f0}.wjx-docs-content h3{font-size:18px;color:#333;margin:24px 0 8px}.wjx-docs-content a{color:#1677ff;text-decoration:none}.wjx-docs-content a:hover{text-decoration:underline}.wjx-docs-content p{margin:0 0 12px}.wjx-docs-content ul,.wjx-docs-content ol{margin:0 0 12px;padding-left:24px}.wjx-docs-content li{margin:4px 0}.wjx-docs-content blockquote{margin:0 0 16px;padding:12px 16px;border-left:4px solid #1677ff;background:#f6f8fa;color:#555}.wjx-docs-content pre{background:#f6f8fa;border:1px solid #e8e8e8;border-radius:6px;padding:16px;overflow:auto}.wjx-docs-content code{font-family:Consolas,monospace;font-size:13px;background:#f6f8fa;padding:2px 5px;border-radius:3px}.wjx-docs-content pre code{background:none;padding:0}.wjx-docs-content table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px}.wjx-docs-content th,.wjx-docs-content td{border:1px solid #e8e8e8;padding:8px 12px;text-align:left}.wjx-docs-content th{background:#fafafa}.wjx-docs-nav{width:232px;flex-shrink:0;position:sticky;top:16px;align-self:flex-start;max-height:calc(100vh - 32px);overflow:auto;border:1px solid #e8e8e8;border-radius:6px;background:#fff;padding:12px 0;font-size:13px}.wjx-docs-nav-title{padding:0 16px 8px;font-weight:600;border-bottom:1px solid #f0f0f0}.wjx-docs-nav-group-header{padding:8px 16px 4px;color:#888;font-size:12px;font-weight:600}.wjx-docs-nav-group-header.collapsible{cursor:pointer}.wjx-docs-nav-group-items.hidden{display:none}.wjx-docs-nav-item{display:block;padding:5px 16px 5px 28px;color:#555;border-left:3px solid transparent}.wjx-docs-nav-item.active{color:#1677ff;background:#e6f4ff;border-left-color:#1677ff}.wjx-docs-menu-toggle{display:none}.wjx-docs-overlay{display:none}@media(max-width:768px){.wjx-docs-root{display:block}.wjx-docs-nav{position:fixed;z-index:10;top:0;right:-280px;width:270px;height:100vh;max-height:none;border-radius:0;transition:right .2s}.wjx-docs-nav.open{right:0}.wjx-docs-menu-toggle{display:block;position:fixed;z-index:11;right:18px;bottom:18px;width:46px;height:46px;border:0;border-radius:50%;background:#1677ff;color:#fff;font-size:20px}.wjx-docs-overlay.open{display:block;position:fixed;z-index:9;inset:0;background:#0005}}
</style></head><body><div class="wjx-docs-root"><main class="wjx-docs-content" id="wjxDocsContent"></main><nav class="wjx-docs-nav" id="wjxDocsNav"><div class="wjx-docs-nav-title">文档导航</div><div id="wjxDocsMenu"></div></nav></div><button class="wjx-docs-menu-toggle" id="wjxDocsMenuToggle" aria-label="打开文档导航">☰</button><div class="wjx-docs-overlay" id="wjxDocsOverlay"></div>
<script src="https://cdn.jsdelivr.net/npm/marked@18/marked.min.js"></script><script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/common.min.js"></script><script>
var DOCS=${docsJson};var MENU=${menuJson};(function(){var menu=document.getElementById('wjxDocsMenu'),content=document.getElementById('wjxDocsContent');menu.innerHTML=MENU.map(function(g){var cls=g.collapsed?' collapsible collapsed':'';var hidden=g.collapsed?' hidden':'';return '<div class="wjx-docs-nav-group"><div class="wjx-docs-nav-group-header'+cls+'">'+g.group+(g.collapsed?' ▾':'')+'</div><div class="wjx-docs-nav-group-items'+hidden+'">'+g.items.map(function(i){return '<a class="wjx-docs-nav-item" data-key="'+i.key+'" href="#'+i.id+'">'+i.label+'</a>';}).join('')+'</div></div>';}).join('');menu.querySelectorAll('.collapsible').forEach(function(h){h.addEventListener('click',function(){h.classList.toggle('collapsed');h.nextElementSibling.classList.toggle('hidden');});});function current(){var h=location.hash.slice(1);return MENU.flatMap(function(g){return g.items;}).some(function(i){return i.id===h;})?MENU.flatMap(function(g){return g.items;}).find(function(i){return i.id===h;}).key:'index';}function render(){var key=current();content.innerHTML=marked.parse(DOCS[key]||'');menu.querySelectorAll('.wjx-docs-nav-item').forEach(function(a){a.classList.toggle('active',a.dataset.key===key);});var active=MENU.flatMap(function(g){return g.items;}).find(function(i){return i.key===key;})||{label:'文档'};document.title=active.label+' - wjx-ai-kit';}window.addEventListener('hashchange',render);document.getElementById('wjxDocsMenuToggle').onclick=function(){document.getElementById('wjxDocsNav').classList.toggle('open');document.getElementById('wjxDocsOverlay').classList.toggle('open');};document.getElementById('wjxDocsOverlay').onclick=function(){document.getElementById('wjxDocsNav').classList.remove('open');this.classList.remove('open');};render();})();</script></body></html>`;

const inline = { h1: "font-size:24px;color:#222;margin:14px 0 10px;padding-bottom:8px;border-bottom:2px solid #f0f0f0;", h2: "font-size:20px;color:#222;margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid #f0f0f0;", h3: "font-size:17px;color:#333;margin:14px 0 6px;", p: "margin:0 0 8px;line-height:1.7;", a: "color:#1677ff;text-decoration:none;", ul: "margin:0 0 8px;padding-left:24px;", ol: "margin:0 0 8px;padding-left:24px;", li: "margin:2px 0;", pre: "background:#f6f8fa;border:1px solid #e8e8e8;border-radius:6px;padding:12px;overflow-x:auto;font:13px/1.5 Consolas,monospace;white-space:pre;", code: "font:13px Consolas,monospace;background:#f6f8fa;padding:2px 5px;border-radius:3px;", table: "width:100%;border-collapse:collapse;margin:0 0 10px;font-size:14px;", cell: "border:1px solid #e8e8e8;padding:6px 10px;text-align:left;" };
const escapeHtml = (value) => String(value).replace(/[&<>\"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
}[char]));
const renderer = new marked.Renderer();
renderer.heading = ({ tokens, depth }) => `<h${depth} style="${inline[`h${Math.min(depth, 3)}`] || ""}">${renderer.parser.parseInline(tokens)}</h${depth}>\n`;
renderer.paragraph = ({ tokens }) => `<p style="${inline.p}">${renderer.parser.parseInline(tokens)}</p>\n`;
renderer.link = ({ href, title, tokens }) => {
  const safeHref = escapeHtml(href || "");
  const safeTitle = title ? ` title="${escapeHtml(title)}"` : "";
  const target = String(href || "").startsWith("#") ? "" : " target=\"_blank\" rel=\"noopener\"";
  return `<a href="${safeHref}" style="${inline.a}"${safeTitle}${target}>${renderer.parser.parseInline(tokens)}</a>`;
};
renderer.list = ({ ordered, items }) => { const tag = ordered ? "ol" : "ul"; return `<${tag} style="${inline[tag]}">${items.map((it) => `<li style="${inline.li}">${renderer.parser.parse(it.tokens).replace(/<p[^>]*>/g, "").replace(/<\/p>/g, "")}</li>`).join("\n")}</${tag}>\n`; };
renderer.blockquote = ({ tokens }) => `<blockquote style="margin:0 0 10px;padding:8px 12px;border-left:4px solid #1677ff;background:#f6f8fa;color:#555;">${renderer.parser.parse(tokens)}</blockquote>\n`;
renderer.code = ({ text }) => `<pre style="${inline.pre}"><code>${escapeHtml(text)}</code></pre>\n`;
renderer.codespan = ({ text }) => `<code style="${inline.code}">${escapeHtml(text)}</code>`;
renderer.table = ({ header, rows }) => `<table style="${inline.table}"><thead><tr>${header.map((c) => `<th style="${inline.cell}">${renderer.parser.parseInline(c.tokens)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td style="${inline.cell}">${renderer.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`).join("\n")}</tbody></table>\n`;
marked.setOptions({ renderer, gfm: true });
const sections = entries.map((entry) => `<section id="${keyToId(entry.key)}" style="margin-bottom:48px;padding-top:20px;">${marked.parse(docs[entry.key])}</section><hr style="border:0;border-top:1px solid #e8e8e8;margin:14px 0;">`).join("\n");
const toc = menu.map((g) => `<li><strong>${g.group}</strong><ul>${g.items.map((i) => `<li><a href="#${i.id}" style="${inline.a}">${i.label}</a></li>`).join("")}</ul></li>`).join("");
const fragment = `<style>.wjx-docs-frag{max-width:960px;margin:0 auto;font:15px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;color:#333}.wjx-docs-frag a{color:#1677ff;text-decoration:none}.wjx-docs-frag img{max-width:100%}</style><div class="wjx-docs-frag"><nav style="background:#fafbfc;border:1px solid #e8e8e8;border-radius:6px;padding:16px 20px;margin-bottom:32px"><strong>文档导航</strong><ul>${toc}</ul></nav>${sections}</div>`;

fs.writeFileSync(outputHtml, htmlTemplate, "utf8");
fs.writeFileSync(outputFragment, fragment, "utf8");
console.log(`Generated ${entries.length} pages, ${vars.MCP_TOOL_COUNT} MCP tools, ${vars.MCP_RESOURCE_COUNT} resources, ${vars.MCP_PROMPT_COUNT} prompts, ${vars.CLI_COMMAND_COUNT} CLI leaf commands.`);
console.log(`  ${path.relative(ROOT, outputHtml)}\n  ${path.relative(ROOT, outputFragment)}`);
