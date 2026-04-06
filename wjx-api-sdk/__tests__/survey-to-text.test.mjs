import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { surveyToText, typeToLabel, stripHtml } from "../dist/index.js";

// ─── Helpers ────────────────────────────────────────────────────────

function makeSurvey(overrides = {}) {
  return {
    vid: 1,
    begin_time: "2026-01-01 00:00:00",
    update_time: "2026-01-01 00:00:00",
    atype: 1,
    title: "测试问卷",
    description: "",
    notes: "",
    version: 0,
    answer_valid: 0,
    answer_total: 0,
    status: 1,
    verify_status: 1,
    creater: "test",
    total_score: 0,
    questions: [],
    ...overrides,
  };
}

function makeQ(overrides = {}) {
  return {
    q_index: 1,
    q_type: 3,
    q_subtype: 3,
    q_title: "题目",
    is_requir: true,
    has_jump: false,
    ...overrides,
  };
}

function makeItem(q_index, item_index, title) {
  return { q_index, item_index, item_title: title, item_image: "", item_score: 0, item_selected: false };
}

// ─── stripHtml ──────────────────────────────────────────────────────

describe("stripHtml", () => {
  it("should remove simple HTML tags", () => {
    assert.equal(stripHtml("<b>bold</b> text"), "bold text");
  });

  it("should replace <br> with newline", () => {
    assert.equal(stripHtml("line1<br>line2"), "line1\nline2");
    assert.equal(stripHtml("line1<br/>line2"), "line1\nline2");
    assert.equal(stripHtml("line1<br />line2"), "line1\nline2");
  });

  it("should strip <img> tags", () => {
    assert.equal(stripHtml('text<img src="a.png"/>more'), "textmore");
  });

  it("should trim whitespace", () => {
    assert.equal(stripHtml("  hello  "), "hello");
  });

  it("should handle empty string", () => {
    assert.equal(stripHtml(""), "");
  });
});

// ─── typeToLabel ────────────────────────────────────────────────────

describe("typeToLabel", () => {
  it("should return [单选题] for q_type=3, q_subtype=3", () => {
    assert.equal(typeToLabel(3, 3), "[单选题]");
  });

  it("should return [多选题] for q_type=4, q_subtype=4", () => {
    assert.equal(typeToLabel(4, 4), "[多选题]");
  });

  it("should return [下拉框] for q_type=3, q_subtype=301", () => {
    assert.equal(typeToLabel(3, 301), "[下拉框]");
  });

  it("should return [量表题] for q_type=3, q_subtype=302", () => {
    assert.equal(typeToLabel(3, 302), "[量表题]");
  });

  it("should return [判断题] for q_type=3, q_subtype=305", () => {
    assert.equal(typeToLabel(3, 305), "[判断题]");
  });

  it("should return [排序题] for q_type=4, q_subtype=402", () => {
    assert.equal(typeToLabel(4, 402), "[排序题]");
  });

  it("should return [填空题] for q_type=5, q_subtype=5", () => {
    assert.equal(typeToLabel(5, 5), "[填空题]");
  });

  it("should return [多项填空题] for q_type=6, q_subtype=6", () => {
    assert.equal(typeToLabel(6, 6), "[多项填空题]");
  });

  it("should return [矩阵题] for q_type=7, q_subtype=7", () => {
    assert.equal(typeToLabel(7, 7), "[矩阵题]");
  });

  it("should return [矩阵量表题] for q_type=7, q_subtype=701", () => {
    assert.equal(typeToLabel(7, 701), "[矩阵量表题]");
  });

  it("should return [矩阵单选题] for q_type=7, q_subtype=702", () => {
    assert.equal(typeToLabel(7, 702), "[矩阵单选题]");
  });

  it("should return [矩阵多选题] for q_type=7, q_subtype=703", () => {
    assert.equal(typeToLabel(7, 703), "[矩阵多选题]");
  });

  it("should return [比重题] for q_type=9, q_subtype=9", () => {
    assert.equal(typeToLabel(9, 9), "[比重题]");
  });

  it("should return [滑动条] for q_type=10, q_subtype=10", () => {
    assert.equal(typeToLabel(10, 10), "[滑动条]");
  });

  it("should return [文件上传] for q_type=8, q_subtype=8", () => {
    assert.equal(typeToLabel(8, 8), "[文件上传]");
  });

  it("should return [绘图题] for q_type=8, q_subtype=801", () => {
    assert.equal(typeToLabel(8, 801), "[绘图题]");
  });

  it("should return [分页栏] for q_type=1, q_subtype=1", () => {
    assert.equal(typeToLabel(1, 1), "[分页栏]");
  });

  it("should return [段落说明] for q_type=2, q_subtype=2", () => {
    assert.equal(typeToLabel(2, 2), "[段落说明]");
  });

  it("should return [评分单选] for q_type=3, q_subtype=303", () => {
    assert.equal(typeToLabel(3, 303), "[评分单选]");
  });

  it("should return [情景题] for q_type=3, q_subtype=304", () => {
    assert.equal(typeToLabel(3, 304), "[情景题]");
  });

  it("should return [评分多选] for q_type=4, q_subtype=401", () => {
    assert.equal(typeToLabel(4, 401), "[评分多选]");
  });

  it("should return [商品题] for q_type=4, q_subtype=403", () => {
    assert.equal(typeToLabel(4, 403), "[商品题]");
  });

  it("should return [多级下拉题] for q_type=5, q_subtype=501", () => {
    assert.equal(typeToLabel(5, 501), "[多级下拉题]");
  });

  // All matrix sub-variants (704-712)
  for (const [sub, label] of [
    [704, "[矩阵填空题]"], [705, "[矩阵评分题]"], [706, "[矩阵滑块题]"],
    [707, "[矩阵NPS题]"], [708, "[矩阵下拉题]"], [709, "[矩阵判断题]"],
    [710, "[矩阵排序题]"], [711, "[矩阵比重题]"], [712, "[矩阵表格题]"],
  ]) {
    it(`should return ${label} for q_type=7, q_subtype=${sub}`, () => {
      assert.equal(typeToLabel(7, sub), label);
    });
  }

  it("should fallback for unknown type", () => {
    assert.equal(typeToLabel(99, 99), "[未知题型:99/99]");
  });

  it("should fallback for known type but unknown subtype", () => {
    assert.equal(typeToLabel(3, 999), "[单选题]");
  });
});

// ─── surveyToText: structure / boundary ─────────────────────────────

describe("surveyToText structure", () => {
  it("should output title only for empty survey (no questions)", () => {
    const result = surveyToText(makeSurvey({ title: "空问卷", questions: [] }));
    assert.equal(result, "空问卷");
  });

  it("should output title only when questions is undefined", () => {
    const result = surveyToText(makeSurvey({ title: "无题", questions: undefined }));
    assert.equal(result, "无题");
  });

  it("should include description when non-empty", () => {
    const result = surveyToText(makeSurvey({ title: "T", description: "描述文本" }));
    assert.ok(result.includes("描述文本"));
  });

  it("should not include description when empty", () => {
    const result = surveyToText(makeSurvey({ title: "T", description: "" }));
    assert.equal(result, "T");
  });

  it("should number questions sequentially", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({ q_index: 1, q_title: "Q1" }),
        makeQ({ q_index: 2, q_title: "Q2" }),
        makeQ({ q_index: 3, q_title: "Q3" }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("1. Q1"));
    assert.ok(result.includes("2. Q2"));
    assert.ok(result.includes("3. Q3"));
  });

  it("should strip HTML from title", () => {
    const result = surveyToText(makeSurvey({ title: "<b>Bold</b> Title" }));
    assert.ok(result.startsWith("Bold Title"));
  });

  it("should strip HTML from question title", () => {
    const survey = makeSurvey({
      questions: [makeQ({ q_title: "<b>加粗</b>题目" })],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("加粗题目"));
    assert.ok(!result.includes("<b>"));
  });
});

// ─── surveyToText: page breaks ──────────────────────────────────────

describe("surveyToText page breaks", () => {
  it("should NOT output page separator for single page", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({ q_type: 1, q_subtype: 1, q_title: "" }), // page break
        makeQ({ q_index: 1, q_title: "Q1" }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(!result.includes("=== 分页 ==="));
  });

  it("should output page separator between pages", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({ q_type: 1, q_subtype: 1, q_title: "" }),
        makeQ({ q_index: 1, q_title: "Page1-Q1" }),
        makeQ({ q_type: 1, q_subtype: 1, q_title: "" }),
        makeQ({ q_index: 2, q_title: "Page2-Q1" }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("=== 分页 ==="));
    assert.ok(result.includes("1. Page1-Q1"));
    assert.ok(result.includes("2. Page2-Q1"));
  });

  it("should not add trailing page separator", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({ q_type: 1, q_subtype: 1, q_title: "" }),
        makeQ({ q_index: 1, q_title: "Q1" }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(!result.endsWith("=== 分页 ==="));
  });

  it("should handle empty page (page break immediately followed by page break)", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({ q_type: 1, q_subtype: 1, q_title: "" }),
        makeQ({ q_type: 1, q_subtype: 1, q_title: "" }),
        makeQ({ q_index: 1, q_title: "Only" }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("=== 分页 ==="));
    assert.ok(result.includes("1. Only"));
  });
});

// ─── surveyToText: paragraph (q_type=2) ─────────────────────────────

describe("surveyToText paragraph", () => {
  it("should render paragraph without number", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({ q_type: 2, q_subtype: 2, q_title: "以下是第二部分" }),
        makeQ({ q_index: 1, q_title: "Q1" }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("以下是第二部分"));
    assert.ok(!result.includes("1. 以下是第二部分"));
    assert.ok(result.includes("1. Q1"));
  });
});

// ─── surveyToText: single choice (q_type=3, q_subtype=3) ───────────

describe("surveyToText single choice", () => {
  it("should list options", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({
          q_title: "性别",
          items: [makeItem(1, 1, "男"), makeItem(1, 2, "女")],
        }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("男"));
    assert.ok(result.includes("女"));
  });

  it("should handle question with no items", () => {
    const survey = makeSurvey({
      questions: [makeQ({ q_title: "空选项" })],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("1. 空选项[单选题]"));
  });
});

// ─── surveyToText: multi choice (q_type=4) ──────────────────────────

describe("surveyToText multi choice", () => {
  it("should list options for multi-select", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({
          q_type: 4, q_subtype: 4, q_title: "爱好",
          items: [makeItem(1, 1, "阅读"), makeItem(1, 2, "运动")],
        }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("[多选题]"));
    assert.ok(result.includes("阅读"));
    assert.ok(result.includes("运动"));
  });
});

// ─── surveyToText: dropdown (q_type=3, q_subtype=301) ───────────────

describe("surveyToText dropdown", () => {
  it("should list dropdown options", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({
          q_subtype: 301, q_title: "学历",
          items: [makeItem(1, 1, "高中"), makeItem(1, 2, "本科")],
        }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("[下拉框]"));
    assert.ok(result.includes("高中"));
  });
});

// ─── surveyToText: scale (q_type=3, q_subtype=302) ─────────────────

describe("surveyToText scale", () => {
  it("should render scale as min~max range", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({
          q_subtype: 302, q_title: "满意度",
          items: [
            makeItem(1, 1, "1"), makeItem(1, 2, "2"), makeItem(1, 3, "3"),
            makeItem(1, 4, "4"), makeItem(1, 5, "5"),
          ],
        }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("[量表题]"));
    assert.ok(result.includes("1~5"));
  });

  it("should handle scale with single item", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({
          q_subtype: 302, q_title: "Scale",
          items: [makeItem(1, 1, "只有一个")],
        }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("只有一个~只有一个"));
  });

  it("should handle scale with no items", () => {
    const survey = makeSurvey({
      questions: [makeQ({ q_subtype: 302, q_title: "NoItems" })],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("NoItems[量表题]"));
  });
});

// ─── surveyToText: true/false (q_type=3, q_subtype=305) ────────────

describe("surveyToText true/false", () => {
  it("should render judgment items", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({
          q_subtype: 305, q_title: "地球是圆的",
          is_panduan: true,
          items: [makeItem(1, 1, "对"), makeItem(1, 2, "错")],
        }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("[判断题]"));
    assert.ok(result.includes("对"));
    assert.ok(result.includes("错"));
  });
});

// ─── surveyToText: fill-in (q_type=5) ──────────────────────────────

describe("surveyToText fill-in", () => {
  it("should render fill-in with no body", () => {
    const survey = makeSurvey({
      questions: [makeQ({ q_type: 5, q_subtype: 5, q_title: "姓名" })],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("1. 姓名[填空题]"));
  });
});

// ─── surveyToText: multi-fill (q_type=6) ───────────────────────────

describe("surveyToText multi-fill", () => {
  it("should render fill slots with ____ prefix", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({
          q_type: 6, q_subtype: 6, q_title: "联系方式",
          items: [makeItem(1, 1, "手机"), makeItem(1, 2, "邮箱")],
        }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("____手机"));
    assert.ok(result.includes("____邮箱"));
  });

  it("should handle multi-fill with gap_count but no items", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({ q_type: 6, q_subtype: 6, q_title: "填空", gap_count: 3 }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("3 个填空项"));
  });

  it("should handle multi-fill with no items and no gap_count", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({ q_type: 6, q_subtype: 6, q_title: "空" }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("1. 空[多项填空题]"));
  });
});

// ─── surveyToText: matrix (q_type=7) ───────────────────────────────

describe("surveyToText matrix", () => {
  it("should render matrix rows", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({
          q_type: 7, q_subtype: 702, q_title: "评价",
          items: [makeItem(1, 1, "价格"), makeItem(1, 2, "质量")],
        }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("[矩阵单选题]"));
    assert.ok(result.includes("行："));
    assert.ok(result.includes("- 价格"));
    assert.ok(result.includes("- 质量"));
  });

  it("should handle matrix with no items (API normalised)", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({ q_type: 7, q_subtype: 7, q_title: "空矩阵", matrix_mode: 0 }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("1. 空矩阵[矩阵题]"));
    assert.ok(!result.includes("行："));
  });
});

// ─── surveyToText: ranking (q_type=4, q_subtype=402) ───────────────

describe("surveyToText ranking", () => {
  it("should list ranking items", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({
          q_type: 4, q_subtype: 402, q_title: "排序",
          items: [makeItem(1, 1, "A"), makeItem(1, 2, "B"), makeItem(1, 3, "C")],
        }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("[排序题]"));
    assert.ok(result.includes("A"));
    assert.ok(result.includes("B"));
  });
});

// ─── surveyToText: weight (q_type=9) ───────────────────────────────

describe("surveyToText weight", () => {
  it("should show total and items", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({
          q_type: 9, q_subtype: 9, q_title: "分配",
          total: 100,
          items: [makeItem(1, 1, "功能"), makeItem(1, 2, "价格")],
        }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("[比重题]"));
    assert.ok(result.includes("总分：100"));
    assert.ok(result.includes("功能"));
    assert.ok(result.includes("价格"));
  });

  it("should handle weight without total", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({ q_type: 9, q_subtype: 9, q_title: "W" }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("1. W[比重题]"));
    assert.ok(!result.includes("总分"));
  });
});

// ─── surveyToText: slider (q_type=10) ──────────────────────────────

describe("surveyToText slider", () => {
  it("should render min~max range", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({ q_type: 10, q_subtype: 10, q_title: "满意度", min_value: 0, max_value: 100 }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("[滑动条]"));
    assert.ok(result.includes("0~100"));
  });

  it("should default to 0~100 when min/max missing", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({ q_type: 10, q_subtype: 10, q_title: "S" }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("0~100"));
  });
});

// ─── surveyToText: file upload (q_type=8) ──────────────────────────

describe("surveyToText file upload", () => {
  it("should render file upload with no body", () => {
    const survey = makeSurvey({
      questions: [makeQ({ q_type: 8, q_subtype: 8, q_title: "上传文件" })],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("1. 上传文件[文件上传]"));
  });
});

// ─── surveyToText: optional mark ────────────────────────────────────

describe("surveyToText optional mark", () => {
  it("should add （选填） for non-required questions", () => {
    const survey = makeSurvey({
      questions: [makeQ({ q_title: "Optional", is_requir: false })],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("（选填）"));
  });

  it("should NOT add （选填） for required questions", () => {
    const survey = makeSurvey({
      questions: [makeQ({ q_title: "Required", is_requir: true })],
    });
    const result = surveyToText(survey);
    assert.ok(!result.includes("（选填）"));
  });
});

// ─── surveyToText: unknown type fallback ────────────────────────────

describe("surveyToText unknown type", () => {
  it("should still render items for unknown q_type", () => {
    const survey = makeSurvey({
      questions: [
        makeQ({
          q_type: 99, q_subtype: 99, q_title: "Unknown",
          items: [makeItem(1, 1, "X"), makeItem(1, 2, "Y")],
        }),
      ],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("[未知题型:99/99]"));
    assert.ok(result.includes("X"));
    assert.ok(result.includes("Y"));
  });
});

// ─── surveyToText: comprehensive real-world scenario ────────────────

describe("surveyToText comprehensive", () => {
  it("should handle a multi-page mixed-type survey", () => {
    const survey = makeSurvey({
      title: "员工满意度调查",
      description: "请认真填写",
      questions: [
        // Page 1
        makeQ({ q_type: 1, q_subtype: 1, q_title: "" }),
        makeQ({ q_type: 2, q_subtype: 2, q_title: "基本信息" }),
        makeQ({
          q_index: 1, q_title: "性别", items: [makeItem(1, 1, "男"), makeItem(1, 2, "女")],
        }),
        makeQ({
          q_index: 2, q_type: 4, q_subtype: 4, q_title: "爱好",
          items: [makeItem(2, 1, "读书"), makeItem(2, 2, "运动")],
        }),
        // Page 2
        makeQ({ q_type: 1, q_subtype: 1, q_title: "" }),
        makeQ({
          q_index: 3, q_subtype: 302, q_title: "满意度",
          items: [makeItem(3, 1, "1"), makeItem(3, 2, "2"), makeItem(3, 3, "3"), makeItem(3, 4, "4"), makeItem(3, 5, "5")],
        }),
        makeQ({
          q_index: 4, q_type: 5, q_subtype: 5, q_title: "建议", is_requir: false,
        }),
      ],
    });

    const result = surveyToText(survey);

    // Title + description
    assert.ok(result.startsWith("员工满意度调查"));
    assert.ok(result.includes("请认真填写"));

    // Paragraph without number
    assert.ok(result.includes("基本信息"));
    assert.ok(!result.includes("1. 基本信息"));

    // Questions numbered correctly
    assert.ok(result.includes("1. 性别[单选题]"));
    assert.ok(result.includes("2. 爱好[多选题]"));

    // Page separator
    assert.ok(result.includes("=== 分页 ==="));

    // Scale as range
    assert.ok(result.includes("3. 满意度[量表题]"));
    assert.ok(result.includes("1~5"));

    // Optional mark
    assert.ok(result.includes("4. 建议[填空题]（选填）"));
  });

  it("should handle survey with 50+ questions (stress test)", () => {
    const questions = [makeQ({ q_type: 1, q_subtype: 1, q_title: "" })];
    for (let i = 1; i <= 50; i++) {
      questions.push(makeQ({ q_index: i, q_title: `Q${i}` }));
    }
    const survey = makeSurvey({ questions });
    const result = surveyToText(survey);
    assert.ok(result.includes("1. Q1"));
    assert.ok(result.includes("50. Q50"));
  });
});

// ─── surveyToText: null safety ──────────────────────────────────────

describe("surveyToText null safety", () => {
  it("should handle null items gracefully", () => {
    const survey = makeSurvey({
      questions: [makeQ({ q_title: "NoItems", items: null })],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("1. NoItems[单选题]"));
  });

  it("should handle empty items array", () => {
    const survey = makeSurvey({
      questions: [makeQ({ q_title: "EmptyItems", items: [] })],
    });
    const result = surveyToText(survey);
    assert.ok(result.includes("1. EmptyItems[单选题]"));
  });

  it("should handle null questions (no crash)", () => {
    const survey = makeSurvey({ questions: null });
    const result = surveyToText(survey);
    assert.equal(result, "测试问卷");
  });
});
