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
  base_types: {
    radio: "单选",
    radio_down: "下拉（别名 dropdown）",
    check: "多选（Mode=1 即排序，别名 sort）",
    question: "简答/文本，题型由 Verify 决定",
    gapfill: "填空/完形（GapCount + 每空一个 row）",
    fileupload: "文件上传/签名（别名 signature、drawing）",
    sum: "比重题（Total + 每行一个 row）",
    slider: "滑动条",
    matrix: "矩阵/表格系列，形态由 Mode 决定",
    page: "分页",
    cut: "段落说明",
  },
  common_aliases: [
    "dropdown", "scale", "sort", "scenario", "true_false", "commodity", "multi_level_dropdown",
    "signature", "drawing", "matrix_single", "matrix_multi", "matrix_scale", "matrix_fill",
    "matrix_slider", "matrix_numeric", "table_fill", "table_dropdown", "table_combo",
    "multi_file", "multi_textarea", "exam_multi_fill", "exam_cloze",
  ],
  invalid_types_note:
    "checkbox/text/multi_text/upload/weight/matrix_radio/matrix_checkbox/matrix_text 不是后端题型标识；对应能力分别用 check、question/gapfill、fileupload、sum、matrix_single、matrix_multi、matrix_fill。",
  advanced_types_note:
    "别名未覆盖的高级题型用 Generic 别名 node \"Question\" 直接写：基础 Type + 后端读取的标识属性（Mode/Verify/HasValue/IsCeShi/IsSignature/IsQingJing/IsEvaluate/IsLadder/IsTouPiao/IsShop/IsShelf/IsAppointment/Relation/Height）。",
  advanced_types_examples: {
    NPS: "radio + Mode=\"6\" + HasValue=\"true\"",
    评价星级: "radio + IsEvaluate=\"true\" + HasValue=\"true\"",
    社会阶层: "radio + IsLadder=\"true\"",
    性别学历等: "radio + Verify=\"性别\"（年龄段/学历/婚姻/职业/行业同理）",
    手机日期邮箱: "question + Verify=\"手机\"（日期/Email 同理）",
    矩阵高级模型: "matrix + Mode（如 302）+ Verify（conjoint/maxdiff/bpto/vlookup/ocr 等）",
    考试题: "原题型 + IsCeShi=\"true\" + CeShiValue=\"<分值>\"",
  },
  advanced_types_caveat:
    "标识不在 <Question> 属性上的题型（热力图、折叠栏目、轮播图、知情同意书、品牌漏斗、部门/其它信息，以及 langv/clock 等渲染由后端决定的 Verify）不要用 raw node 硬凑，改用编辑器或 JSONL 创建（create_survey_by_json 传中文 qtype）。",
  question_examples: {
    check: `question check {
  attr "Topic" = "2";
  attr "Title" = "以下哪些功能你会使用";
  attr "MinValue" = "1"; attr "MaxValue" = "3";
  item { attr "ItemTitle" = "导出"; attr "ItemValue" = "1"; };
  item { attr "ItemTitle" = "分享"; attr "ItemValue" = "2"; };
};`,
    gapfill: `question gapfill {
  attr "Topic" = "3";
  attr "Title" = "我最喜欢的城市是 ___，因为 ___";
  attr "GapCount" = "2";
  row { attr "Title" = "城市"; attr "ItemVerify" = "单行文本"; attr "IsRequir" = "true"; };
  row { attr "Title" = "原因"; attr "ItemVerify" = "多行文本"; };
};`,
    matrix: `question matrix {
  attr "Topic" = "5";
  attr "Title" = "请对以下方面评分";
  attr "Mode" = "2";
  row { attr "Title" = "响应速度"; };
  row { attr "Title" = "界面体验"; };
  item { attr "ItemTitle" = "满意"; attr "ItemValue" = "1"; };
  item { attr "ItemTitle" = "一般"; attr "ItemValue" = "2"; };
};`,
  },
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
