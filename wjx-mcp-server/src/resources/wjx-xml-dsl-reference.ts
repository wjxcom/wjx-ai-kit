export const WJX_XML_DSL_GUIDE = {
  title: "WJX XML DSL reference",
  referenceVersion: "1.0.0",
  protocol: "wjx-dsl 1",
  description: "Complete questionnaire XML DSL used by the query/create/update APIs.",
  workflow: {
    query: ["query_wjx_dsl with a traditional encoded vid", "use returned dsl as the update input"],
    create: ["generate a complete DSL", "create_survey_by_wjx_dsl"],
    createOptions: ["atype?", "publish?", "compress_img?"],
    update: ["query_wjx_dsl", "modify the complete DSL", "update_wjx_dsl"],
  },
  syntax: {
    header: ["wjx-dsl 1;", 'xml version = "1.0";', 'xml encoding = "utf-8";'],
    root: "questionnaire { ... };",
    statements: ['attr "Name" = "value";', 'text "value";', 'cdata "value";', 'node "ElementName" { ... };'],
    aliases: [
      "page", "cut", "question", "item", "row", "rightrow", "column",
      "dropdown", "scale", "sort", "scenario", "true_false", "commodity",
      "multi_level_dropdown", "signature", "scoring_single", "scoring_multi",
      "matrix_scale", "matrix_single", "matrix_multi", "matrix_fill", "matrix_slider",
      "matrix_numeric", "table_numeric", "table_combo", "table_incremental",
      "multi_file", "multi_textarea", "table_fill", "table_dropdown",
      "appointment", "reservation", "shelf", "exam_multi_fill", "exam_cloze", "cloze",
      "conjoint", "maxdiff", "bws", "circulate", "kano", "ai_grading", "video",
      "company", "psm", "level", "citylevel", "contacts_user", "test", "ai_interview", "radio_cati",
      "ocr", "sus", "bpto", "price_breakpoint", "classify", "device",
      "map", "date", "ai", "ai_hci", "store_select", "name", "id_number", "country_region",
      "city_select", "region", "email", "phone", "university", "password",
      "texthighlights", "text_highlights",
      "other", "item_textbox", "itemtextbox",
    ],
  questionAliasNotes: "Semantic aliases normalize to the production base Type and fill only missing Mode/Verify/flag attributes; explicit attributes win. contacts_user uses question + Verify=ContactsUser because that is the legacy editor contact-field shape. Option aliases other/item_textbox fill ItemTextBox=true. Matrix input modes may carry protocol choice items only when ItemJump=0; empty ItemJump values are legacy editor placeholders. Item nodes use ItemTitle/ItemValue; matrix/table row, rightrow, and column nodes use Title (and optional ItemValue). Historical extension Type names remain available through node \"Question\". OCR still requires its row-level business payload attributes.",
  },
  supportMatrix: {
    baseTypes: [
      "page", "cut", "radio", "radio_down", "check", "question", "gapfill",
      "fileupload", "sum", "slider", "matrix",
    ],
    matrixModes: {
      "2/3/6/7": ["row", "item"],
      "101": ["row", "rightrow?", "item"],
      "102/103": ["row", "item"],
      "201": ["row", "item(ItemJump=0)?"],
      "202": ["row", "rightrow?", "item(ItemJump=0)?"],
      "203": ["row(ItemVerify=文件上传)"],
      "204": ["row(ItemVerify=多项简答)"],
      "301/302": ["row", "column", "item(ItemJump=0)?"],
      "303": ["row", "column", "item"],
    },
    advancedAttributes: {
      choice: ["HasValue", "IsTouPiao", "DisplayPercent", "DisplayNum", "MinValue", "MaxValue", "PartScore", "GroupMutual"],
      textAndGapfill: ["Verify", "Height", "MinWord", "MaxWord", "GapCount", "NeedOnly", "LevelData", "IsCloze"],
      uploadSliderSum: ["Ext", "MaxSize", "MaxLength", "IsSignature", "Size", "SignatureBg", "Total", "RowWidth", "MinValue", "MaxValue", "MinValueText", "MaxValueText", "DigitType"],
      matrix: ["HasValue", "RandomRow", "RowRightWidth", "DaoZhi", "GroupMutual", "PartRequir", "NoColumn", "DigitType", "ShowMobileScrollBar"],
      protocolRaw: [
        "gsData", "TrendOption", "TrendMode", "TrendRefTopic", "TrendReferedTopic", "TrendAiExtract",
        "LevelData", "LevelDataExternalUrl", "DeptData", "LevelLen", "ContactsUser",
        "TestData", "TestSpeed", "TendencyQA",
        "VideoUrl", "VideoWidthHeight", "NeedVideoQuestion", "VideoNotDrag", "VideoOncePlay", "VideoQuestionOptions",
        "FuzzyQuery", "ProvinceLimitList", "GetMoreCompanyInfo", "PriceSection", "PriceNum",
        "CheckByAi", "AiAnswer", "CheckByAiMode", "AihciAllowUpdate", "AihciModel",
        "Purpose", "SelfPrompt", "AiModel", "AiGoal", "AiHint", "IgnoreSystemPrompt", "Temperature", "TopP", "FrequencyPenalty", "MaxTokens", "AimodelRange", "Interaction", "VoiceType",
        "IsHeatmap", "HeatmapSet", "IsOnlineSign", "OSData", "OSLink", "OSReadGuard", "OSReadTip", "AllowLandscape",
        "IsPsych", "PsychType", "PsychLink", "PsychAllowMobile", "PsychFileName", "IsVoice", "Voice", "VoiceOnly", "CameraType", "CameraOnly",
      ],
    },
    compatibilityNotes: [
      "PartScore and GroupMutual use mutually exclusive legacy payload branches on one check question.",
      "IsCloze requires the legacy IsCeShi encoding; PartRequir is derived from required-question row settings.",
      "SignatureBg must use a URL accepted by the legacy editor converter.",
      "protocolRaw attributes are preserved for XML -> DSL -> XML round-trips; their business payloads are not parsed or regenerated by the DSL compiler.",
      "Attributes outside this matrix may remain in raw XML AST but are not guaranteed to survive legacy editor conversion.",
    ],
  },
  safety: [
    "Create and update use the existing questionnaire persistence paths.",
    "Unknown nodes and attributes must not be silently dropped.",
    "Breaking changes that could alter Answer/AnswerItem indexes are rejected.",
    "The query response keeps the legacy DTO and adds a complete dsl field.",
  ],
  example: `wjx-dsl 1;
xml version = "1.0";
xml encoding = "utf-8";

questionnaire {
  attr "Title" = "Product survey";
  question radio {
    attr "Topic" = "1";
    attr "Title" = "Overall satisfaction";
    attr "Requir" = "true";
    item { attr "ItemTitle" = "Satisfied"; attr "ItemValue" = "1"; };
  };
};`,
} as const;
