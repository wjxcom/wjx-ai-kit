export const DSL_SYNTAX_GUIDE = {
  title: "WJX XML DSL v1",
  version: 1,
  purpose: "AI 依据本规范生成完整 DSL；CLI、MCP、SDK 负责校验和传输，后端负责最终语义校验与写入。",
  header: ["wjx-dsl 1;", "xml version = \"1.0\";", "xml encoding = \"utf-8\";"],
  example: `wjx-dsl 1;
xml version = "1.0";
xml encoding = "utf-8";

questionnaire {
  attr "Title" = "员工满意度调查";
  question radio {
    attr "Topic" = "1";
    attr "Title" = "整体满意度";
    attr "Requir" = "true";
    item { attr "ItemTitle" = "满意"; attr "ItemValue" = "1"; };
  };
};`,
  grammar: {
    statements: "块使用 { }，语句以 ; 结束；字符串使用双引号并支持反斜杠转义。",
    root: "questionnaire { ... }",
    attributes: "attr \"Name\" = \"Value\";",
    question: "question <type> { attr ...; item { attr ...; }; };",
    raw: "raw \"XmlName\" { ... }; 或 raw \"Attr\" = \"Value\";",
  },
  question_types: [
    "radio", "checkbox", "dropdown", "scale", "rating", "judgement", "scenario",
    "ranking", "product", "text", "multi_text", "matrix", "matrix_radio", "matrix_checkbox",
    "matrix_scale", "matrix_text", "matrix_slider", "matrix_number", "table_text", "table_dropdown",
    "table_combo", "table_auto", "multi_file", "multi_textarea", "upload", "drawing", "weight", "slider",
  ],
  logic: ["if", "show", "hide", "jump", "branch", "reference", "random", "raw"],
  logic_rules: {
    references: "使用 Topic/Item 引用；jump/branch 目标为 END 或有效 Topic。",
    validation: "悬空引用、自循环和跳转环由后端最终校验。",
  },
  raw_policy: "未知属性或高级能力使用 raw 显式保留，客户端不得静默删除。",
  api: {
    query: "A1000006",
    create: "A1000109",
    update: "A1000110",
    update_vid: "只接受传统 vid；提交修改后的完整 DSL，不使用增量 Patch DSL。",
  },
};
