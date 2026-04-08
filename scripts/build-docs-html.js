#!/usr/bin/env node
/**
 * build-docs-html.js — 将 wjx-docs/ 下所有 .md 文件内嵌到单个 wjx-kit.html
 *
 * 用法: node scripts/build-docs-html.js
 * 输出: wjx-docs/wjx-kit.html
 */

const { readFileSync, writeFileSync, readdirSync } = require("fs");
const { join, basename } = require("path");

const ROOT = join(__dirname, "..");
const DOCS_DIR = join(ROOT, "wjx-docs");
const OUTPUT = join(DOCS_DIR, "wjx-kit.html");

// 文档菜单定义：分组 + 顺序
const MENU = [
  {
    group: "总览",
    items: [{ key: "00-overview", label: "总纲" }],
  },
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
    collapsed: true,
    items: [
      { key: "setup-claude-code", label: "Claude Code" },
      { key: "setup-claude-desktop", label: "Claude Desktop" },
      { key: "setup-cursor", label: "Cursor" },
      { key: "setup-windsurf", label: "Windsurf" },
      { key: "setup-cline", label: "Cline" },
      { key: "setup-copilot", label: "GitHub Copilot" },
      { key: "setup-trae", label: "Trae" },
      { key: "setup-gemini", label: "Gemini Code Assist" },
      { key: "setup-claw", label: "Claw 系列" },
      { key: "setup-openclaw", label: "OpenClaw" },
      { key: "setup-qoder", label: "Qoder" },
    ],
  },
];

// 读取所有 md 文件
const docs = {};
const mdFiles = readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
for (const file of mdFiles) {
  const key = basename(file, ".md");
  docs[key] = readFileSync(join(DOCS_DIR, file), "utf-8");
}

console.log(`读取了 ${Object.keys(docs).length} 个文档`);

// HTML 模板
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>wjx-ai-kit 文档 — 用 AI 重新定义问卷调研</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github.min.css">
<style>
/* ===== 基础重置 ===== */
.wjx-docs-root * { box-sizing: border-box; }
.wjx-docs-root {
  display: flex;
  gap: 24px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 15px;
  line-height: 1.7;
  color: #333;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  position: relative;
}

/* ===== 主内容区 ===== */
.wjx-docs-content {
  flex: 1;
  min-width: 0;
  padding-bottom: 40px;
}
.wjx-docs-content h1 { font-size: 28px; color: #222; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0; }
.wjx-docs-content h2 { font-size: 22px; color: #222; margin: 32px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; }
.wjx-docs-content h3 { font-size: 18px; color: #333; margin: 24px 0 8px; }
.wjx-docs-content h4 { font-size: 16px; color: #444; margin: 20px 0 8px; }
.wjx-docs-content a { color: #1890ff; text-decoration: none; }
.wjx-docs-content a:hover { text-decoration: underline; }
.wjx-docs-content p { margin: 0 0 12px; }
.wjx-docs-content ul, .wjx-docs-content ol { margin: 0 0 12px; padding-left: 24px; }
.wjx-docs-content li { margin: 4px 0; }
.wjx-docs-content blockquote {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-left: 4px solid #1890ff;
  background: #f6f8fa;
  color: #555;
}
.wjx-docs-content blockquote p:last-child { margin-bottom: 0; }
.wjx-docs-content hr { border: none; border-top: 1px solid #e8e8e8; margin: 24px 0; }
.wjx-docs-content img { max-width: 100%; border-radius: 4px; }

/* 代码 */
.wjx-docs-content code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 13px;
  background: #f6f8fa;
  padding: 2px 6px;
  border-radius: 3px;
}
.wjx-docs-content pre {
  background: #f6f8fa;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin: 0 0 16px;
}
.wjx-docs-content pre code { background: none; padding: 0; font-size: 13px; }

/* 表格 */
.wjx-docs-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 16px;
  font-size: 14px;
}
.wjx-docs-content th, .wjx-docs-content td {
  border: 1px solid #e8e8e8;
  padding: 8px 12px;
  text-align: left;
}
.wjx-docs-content th { background: #fafafa; font-weight: 600; }
.wjx-docs-content tr:nth-child(even) td { background: #fafbfc; }

/* ===== 右侧浮动菜单 ===== */
.wjx-docs-nav {
  width: 220px;
  flex-shrink: 0;
  position: sticky;
  top: 20px;
  align-self: flex-start;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px 0;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.wjx-docs-nav::-webkit-scrollbar { width: 4px; }
.wjx-docs-nav::-webkit-scrollbar-thumb { background: #d9d9d9; border-radius: 2px; }

.wjx-docs-nav-title {
  padding: 0 16px 8px;
  font-size: 14px;
  font-weight: 600;
  color: #222;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
}
.wjx-docs-nav-group { padding: 0; margin: 0; }
.wjx-docs-nav-group-header {
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: default;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
}
.wjx-docs-nav-group-header.collapsible { cursor: pointer; }
.wjx-docs-nav-group-header.collapsible:hover { color: #666; }
.wjx-docs-nav-group-header .arrow { font-size: 10px; transition: transform 0.2s; }
.wjx-docs-nav-group-header.collapsed .arrow { transform: rotate(-90deg); }
.wjx-docs-nav-group-items { overflow: hidden; }
.wjx-docs-nav-group-items.hidden { display: none; }

.wjx-docs-nav-item {
  display: block;
  padding: 5px 16px 5px 28px;
  color: #555;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s;
  border-left: 3px solid transparent;
}
.wjx-docs-nav-item:hover { background: #f6f8fa; color: #1890ff; }
.wjx-docs-nav-item.active {
  color: #1890ff;
  background: #e6f7ff;
  border-left-color: #1890ff;
  font-weight: 500;
}

/* ===== 移动端菜单按钮 ===== */
.wjx-docs-menu-toggle {
  display: none;
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #1890ff;
  color: #fff;
  border: none;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(24,144,255,0.4);
  z-index: 1000;
  align-items: center;
  justify-content: center;
}
.wjx-docs-menu-toggle:hover { background: #40a9ff; }

/* ===== 加载状态 ===== */
.wjx-docs-loading {
  padding: 40px;
  text-align: center;
  color: #999;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .wjx-docs-root { flex-direction: column; }
  .wjx-docs-nav {
    position: fixed;
    top: 0;
    right: -280px;
    width: 260px;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    z-index: 999;
    transition: right 0.3s;
    border-left: 1px solid #e8e8e8;
  }
  .wjx-docs-nav.open { right: 0; box-shadow: -4px 0 16px rgba(0,0,0,0.1); }
  .wjx-docs-menu-toggle { display: flex; }
  .wjx-docs-overlay {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.3);
    z-index: 998;
  }
  .wjx-docs-overlay.open { display: block; }
}
</style>
</head>
<body>

<div class="wjx-docs-root">
  <!-- 主内容区 -->
  <div class="wjx-docs-content" id="wjxDocsContent">
    <div class="wjx-docs-loading">加载中...</div>
  </div>

  <!-- 右侧浮动菜单 -->
  <nav class="wjx-docs-nav" id="wjxDocsNav">
    <div class="wjx-docs-nav-title">文档导航</div>
    <div id="wjxDocsMenu"></div>
  </nav>
</div>

<!-- 移动端菜单按钮 -->
<button class="wjx-docs-menu-toggle" id="wjxDocsMenuToggle" title="文档导航">&#9776;</button>
<div class="wjx-docs-overlay" id="wjxDocsOverlay"></div>

<!-- CDN 依赖 -->
<script src="https://cdn.jsdelivr.net/npm/marked@15/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/core.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/javascript.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/typescript.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/bash.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/json.min.js"></script>
<script>
hljs.registerLanguage("javascript", hljs.getLanguage("javascript") || function(){return{}});
hljs.registerLanguage("typescript", hljs.getLanguage("typescript") || function(){return{}});
hljs.registerLanguage("bash", hljs.getLanguage("bash") || function(){return{}});
hljs.registerLanguage("json", hljs.getLanguage("json") || function(){return{}});
</script>

<script>
// ===== 内嵌文档数据 =====
var DOCS = __DOCS_PLACEHOLDER__;

// ===== 菜单定义 =====
var MENU = __MENU_PLACEHOLDER__;

// ===== 初始化 =====
(function() {
  // marked 配置
  marked.setOptions({
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try { return hljs.highlight(code, { language: lang }).value; } catch(e) {}
      }
      return code;
    },
    breaks: false,
    gfm: true
  });

  // 自定义 renderer：将 md 内部链接转为 hash 路由
  var renderer = new marked.Renderer();
  renderer.link = function(href, title, text) {
    if (typeof href === "object") {
      var token = href;
      href = token.href;
      title = token.title;
      text = token.text;
    }
    if (typeof href === "string") {
      var m = href.match(/^\\.?\\/?([-\\w]+)\\.md$/);
      if (m && DOCS[m[1]]) {
        return '<a href="#doc=' + m[1] + '">' + (text || m[1]) + '</a>';
      }
    }
    var titleAttr = title ? ' title="' + title + '"' : '';
    return '<a href="' + href + '"' + titleAttr + ' target="_blank" rel="noopener">' + (text || href) + '</a>';
  };
  marked.setOptions({ renderer: renderer });

  // 构建菜单
  var menuEl = document.getElementById("wjxDocsMenu");
  var menuHtml = "";
  MENU.forEach(function(group) {
    var collapsible = group.collapsed ? " collapsible collapsed" : (group.items.length > 5 ? " collapsible" : "");
    var hidden = group.collapsed ? " hidden" : "";
    var arrow = (collapsible || group.items.length > 5) ? ' <span class="arrow">&#9660;</span>' : "";
    menuHtml += '<div class="wjx-docs-nav-group">';
    menuHtml += '<div class="wjx-docs-nav-group-header' + collapsible + '">' + group.group + arrow + '</div>';
    menuHtml += '<div class="wjx-docs-nav-group-items' + hidden + '">';
    group.items.forEach(function(item) {
      menuHtml += '<a class="wjx-docs-nav-item" data-key="' + item.key + '" href="#doc=' + item.key + '">' + item.label + '</a>';
    });
    menuHtml += '</div></div>';
  });
  menuEl.innerHTML = menuHtml;

  // 折叠/展开
  menuEl.querySelectorAll(".wjx-docs-nav-group-header.collapsible").forEach(function(header) {
    header.addEventListener("click", function() {
      this.classList.toggle("collapsed");
      this.nextElementSibling.classList.toggle("hidden");
    });
  });

  // 渲染文档
  var contentEl = document.getElementById("wjxDocsContent");
  function renderDoc(key) {
    var md = DOCS[key];
    if (!md) {
      contentEl.innerHTML = '<div class="wjx-docs-loading">文档未找到: ' + key + '</div>';
      return;
    }
    contentEl.innerHTML = marked.parse(md);
    menuEl.querySelectorAll(".wjx-docs-nav-item").forEach(function(el) {
      el.classList.toggle("active", el.dataset.key === key);
      if (el.classList.contains("active")) {
        var items = el.closest(".wjx-docs-nav-group-items");
        if (items && items.classList.contains("hidden")) {
          items.classList.remove("hidden");
          items.previousElementSibling.classList.remove("collapsed");
        }
      }
    });
    contentEl.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("wjxDocsNav").classList.remove("open");
    document.getElementById("wjxDocsOverlay").classList.remove("open");
  }

  function getDocFromHash() {
    var m = location.hash.match(/doc=([-\\w]+)/);
    return m ? m[1] : "00-overview";
  }

  window.addEventListener("hashchange", function() { renderDoc(getDocFromHash()); });

  document.getElementById("wjxDocsMenuToggle").addEventListener("click", function() {
    document.getElementById("wjxDocsNav").classList.toggle("open");
    document.getElementById("wjxDocsOverlay").classList.toggle("open");
  });
  document.getElementById("wjxDocsOverlay").addEventListener("click", function() {
    document.getElementById("wjxDocsNav").classList.remove("open");
    this.classList.remove("open");
  });

  renderDoc(getDocFromHash());
})();
</script>

</body>
</html>`;

// 序列化并替换占位符
const docsJson = JSON.stringify(docs);
const menuJson = JSON.stringify(MENU);
const finalHtml = HTML_TEMPLATE
  .replace("__DOCS_PLACEHOLDER__", docsJson)
  .replace("__MENU_PLACEHOLDER__", menuJson);

writeFileSync(OUTPUT, finalHtml, "utf-8");

const sizeMB = (Buffer.byteLength(finalHtml, "utf-8") / 1024 / 1024).toFixed(2);
console.log(`生成完成: wjx-docs/wjx-kit.html (${sizeMB} MB)`);
