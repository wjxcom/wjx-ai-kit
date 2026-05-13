# SVG 模板填槽语法

模板放在 `templates/slide_layouts/*.svg`，文件名对应页面（如 `P01_Cover.svg`）。
渲染引擎在 `scripts/build_project.py` 的 `_render_svg`，是简化版 Mustache。

## 三种语法

### 1. 标量替换 `{{KEY}}`

```svg
<text>{{TITLE}}</text>
```

context: `{"TITLE": "客户满意度调查"}` → `<text>客户满意度调查</text>`

值会做 XML 转义（`<`、`>`、`&`、`"`）。

### 2. 列表展开 `{{#LIST}}...{{/LIST}}`

```svg
{{#ROWS}}
<rect y="{{Y}}" width="{{COUNT}}" />
<text>{{LABEL}}: {{PERCENT}}%</text>
{{/ROWS}}
```

context: `{"ROWS": [{"Y": 10, "COUNT": 80, "LABEL": "满意", "PERCENT": "67.5"}, ...]}`

每个 item 的字段会**合并到上层 context**，所以循环体内既能用 `{{LABEL}}` 也能用上层的 `{{TITLE}}`。

### 3. 条件块 `{{?KEY}}...{{/KEY}}`

```svg
{{?NPS_VALUE}}
<text>NPS：{{NPS_VALUE}}</text>
{{/NPS_VALUE}}
```

`KEY` 在 context 中不存在，或值为 falsy（None/空字符串/0/空列表）时，整段被删除。

## 常见模板字段

每页 context 字段在 `build_project.py` 的 `_xxx_context()` 里定义。新增一页就加一个 `_yyy_context` 函数，并在 `_TEMPLATES_DIR` 放对应 svg 文件。

## 注意事项

- **viewBox 固定 `0 0 1280 720`**（PPT 16:9 默认尺寸）。其他比例会被 ppt-master 缩放但可能错位。
- **不要嵌套同名 LIST**（`{{#A}}{{#A}}...{{/A}}{{/A}}`），引擎不支持。
- **变量名只能用 `[A-Za-z_]\w*`**——其他字符不识别。
- **不要在循环体外引用循环内的字段**：`{{LABEL}}` 在 `{{#ROWS}}` 块外为空。

## 调试技巧

跑 `python -m wjx_survey_ppt --vid X --plan-only` 只生成 SVG 不渲染 PPTX。
然后用浏览器打开 `<workdir>/project/svg_final/P0X_*.svg` 直接看效果。
