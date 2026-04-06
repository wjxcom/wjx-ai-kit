import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { textToSurvey, surveyToText, parsedQuestionsToWire } from "../dist/index.js";

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
    q_title: "问题",
    is_requir: true,
    has_jump: false,
    ...overrides,
  };
}

// ─── textToSurvey unit tests ────────────────────────────────────────

describe("textToSurvey", () => {
  it("parses title and description", () => {
    const text = "我的问卷\n\n这是问卷描述";
    const result = textToSurvey(text);
    assert.equal(result.title, "我的问卷");
    assert.equal(result.description, "这是问卷描述");
    assert.equal(result.questions.length, 0);
  });

  it("parses single-choice question with options", () => {
    const text = `测试问卷

1. 你最喜欢什么颜色？[单选题]
红色
蓝色
绿色`;
    const result = textToSurvey(text);
    assert.equal(result.questions.length, 1);
    const q = result.questions[0];
    assert.equal(q.type, "single-choice");
    assert.equal(q.title, "你最喜欢什么颜色？");
    assert.equal(q.required, true);
    assert.deepEqual(q.options, ["红色", "蓝色", "绿色"]);
  });

  it("parses multi-choice question", () => {
    const text = `测试问卷

1. 选择你的爱好[多选题]
游泳
跑步
阅读`;
    const result = textToSurvey(text);
    assert.equal(result.questions[0].type, "multi-choice");
    assert.deepEqual(result.questions[0].options, ["游泳", "跑步", "阅读"]);
  });

  it("parses fill-in question (no body)", () => {
    const text = `测试问卷

1. 请输入你的姓名[填空题]`;
    const result = textToSurvey(text);
    assert.equal(result.questions[0].type, "fill-in");
    assert.equal(result.questions[0].title, "请输入你的姓名");
  });

  it("parses scale question with range", () => {
    const text = `测试问卷

1. 满意度评分[量表题]
非常不满意~非常满意`;
    const result = textToSurvey(text);
    const q = result.questions[0];
    assert.equal(q.type, "scale");
    assert.deepEqual(q.scaleRange, ["非常不满意", "非常满意"]);
  });

  it("parses matrix question with rows", () => {
    const text = `测试问卷

1. 请评价以下方面[矩阵题]
行：
- 服务态度
- 响应速度
- 专业能力`;
    const result = textToSurvey(text);
    const q = result.questions[0];
    assert.equal(q.type, "matrix");
    assert.deepEqual(q.matrixRows, ["服务态度", "响应速度", "专业能力"]);
  });

  it("parses paragraph (unnumbered text between questions)", () => {
    const text = `测试问卷

1. 问题一[单选题]
选项A
选项B

这是一段说明文字

2. 问题二[填空题]`;
    const result = textToSurvey(text);
    assert.equal(result.questions.length, 3);
    assert.equal(result.questions[0].type, "single-choice");
    assert.equal(result.questions[1].type, "paragraph");
    assert.equal(result.questions[1].title, "这是一段说明文字");
    assert.equal(result.questions[2].type, "fill-in");
  });

  it("handles optional marker （选填）", () => {
    const text = `测试问卷

1. 备注[填空题]（选填）`;
    const result = textToSurvey(text);
    assert.equal(result.questions[0].required, false);
  });

  it("handles page breaks", () => {
    const text = `测试问卷

1. 问题一[单选题]
是
否

=== 分页 ===

2. 问题二[填空题]`;
    const result = textToSurvey(text);
    assert.equal(result.questions.length, 2);
    assert.equal(result.questions[0].title, "问题一");
    assert.equal(result.questions[1].title, "问题二");
  });

  it("handles empty input", () => {
    const result = textToSurvey("");
    assert.equal(result.title, "");
    assert.equal(result.description, "");
    assert.equal(result.questions.length, 0);
  });
});

// ─── Round-trip tests: surveyToText → textToSurvey ──────────────────

describe("surveyToText → textToSurvey round-trip", () => {
  it("round-trips a single-choice survey", () => {
    const survey = makeSurvey({
      title: "用户满意度调查",
      description: "请认真填写",
      questions: [
        makeQ({
          q_index: 1, q_type: 3, q_subtype: 3,
          q_title: "整体满意度",
          is_requir: true,
          items: [
            { q_index: 1, item_index: 1, item_title: "非常满意" },
            { q_index: 1, item_index: 2, item_title: "满意" },
            { q_index: 1, item_index: 3, item_title: "不满意" },
          ],
        }),
      ],
    });

    const text = surveyToText(survey);
    const parsed = textToSurvey(text);

    assert.equal(parsed.title, "用户满意度调查");
    assert.equal(parsed.description, "请认真填写");
    assert.equal(parsed.questions.length, 1);
    assert.equal(parsed.questions[0].type, "single-choice");
    assert.equal(parsed.questions[0].title, "整体满意度");
    assert.deepEqual(parsed.questions[0].options, ["非常满意", "满意", "不满意"]);
  });

  it("round-trips mixed question types", () => {
    const survey = makeSurvey({
      title: "混合问卷",
      questions: [
        makeQ({
          q_index: 1, q_type: 5, q_subtype: 5,
          q_title: "您的姓名",
          is_requir: true,
        }),
        makeQ({
          q_index: 2, q_type: 2, q_subtype: 2,
          q_title: "以下是兴趣调查",
          is_requir: false,
        }),
        makeQ({
          q_index: 3, q_type: 4, q_subtype: 4,
          q_title: "选择您的兴趣",
          is_requir: true,
          items: [
            { q_index: 3, item_index: 1, item_title: "音乐" },
            { q_index: 3, item_index: 2, item_title: "电影" },
            { q_index: 3, item_index: 3, item_title: "阅读" },
          ],
        }),
        makeQ({
          q_index: 4, q_type: 3, q_subtype: 302,
          q_title: "服务评分",
          is_requir: true,
          items: [
            { q_index: 4, item_index: 1, item_title: "1" },
            { q_index: 4, item_index: 5, item_title: "5" },
          ],
        }),
      ],
    });

    const text = surveyToText(survey);
    const parsed = textToSurvey(text);

    assert.equal(parsed.questions.length, 4);
    // Fill-in
    assert.equal(parsed.questions[0].type, "fill-in");
    assert.equal(parsed.questions[0].title, "您的姓名");
    // Paragraph (q_type=2) — after a numbered question, unnumbered text = paragraph
    assert.equal(parsed.questions[1].type, "paragraph");
    assert.equal(parsed.questions[1].title, "以下是兴趣调查");
    // Multi-choice
    assert.equal(parsed.questions[2].type, "multi-choice");
    assert.deepEqual(parsed.questions[2].options, ["音乐", "电影", "阅读"]);
    // Scale
    assert.equal(parsed.questions[3].type, "scale");
    assert.deepEqual(parsed.questions[3].scaleRange, ["1", "5"]);
  });

  it("round-trips matrix questions", () => {
    const survey = makeSurvey({
      title: "矩阵问卷",
      questions: [
        makeQ({
          q_index: 1, q_type: 7, q_subtype: 7,
          q_title: "请评价",
          is_requir: true,
          items: [
            { q_index: 1, item_index: 1, item_title: "服务" },
            { q_index: 1, item_index: 2, item_title: "价格" },
          ],
        }),
      ],
    });

    const text = surveyToText(survey);
    const parsed = textToSurvey(text);

    assert.equal(parsed.questions[0].type, "matrix");
    assert.deepEqual(parsed.questions[0].matrixRows, ["服务", "价格"]);
  });
});

// ─── New question type labels (v0.1.1) ──────────────────────────────

describe("textToSurvey: new question type labels", () => {
  // Helper: parse a single question with the given label
  function parseSingle(label, body = "") {
    const text = `测试\n\n1. 题目${label}\n${body}`;
    const result = textToSurvey(text);
    return result.questions[0];
  }

  it("parses [简答题] as fill-in", () => {
    assert.equal(parseSingle("[简答题]").type, "fill-in");
  });

  it("parses [问答题] as fill-in", () => {
    assert.equal(parseSingle("[问答题]").type, "fill-in");
  });

  it("parses [多项填空题] as multi-fill", () => {
    assert.equal(parseSingle("[多项填空题]").type, "multi-fill");
  });

  it("parses [考试多项填空] as exam-multi-fill", () => {
    assert.equal(parseSingle("[考试多项填空]").type, "exam-multi-fill");
  });

  it("parses [考试完形填空] as exam-cloze", () => {
    assert.equal(parseSingle("[考试完形填空]").type, "exam-cloze");
  });

  it("parses [完形填空] as exam-cloze", () => {
    assert.equal(parseSingle("[完形填空]").type, "exam-cloze");
  });

  it("parses [滑动条] as slider with range", () => {
    const q = parseSingle("[滑动条]", "0~100");
    assert.equal(q.type, "slider");
    assert.deepEqual(q.scaleRange, ["0", "100"]);
  });

  it("parses [商品题] as commodity with options", () => {
    const q = parseSingle("[商品题]", "商品A\n商品B");
    assert.equal(q.type, "commodity");
    assert.deepEqual(q.options, ["商品A", "商品B"]);
  });

  it("parses [情景题] as scenario with options", () => {
    const q = parseSingle("[情景题]", "场景一\n场景二");
    assert.equal(q.type, "scenario");
    assert.deepEqual(q.options, ["场景一", "场景二"]);
  });

  it("parses [矩阵量表题] as matrix-scale with rows", () => {
    const q = parseSingle("[矩阵量表题]", "行：\n- 维度A\n- 维度B");
    assert.equal(q.type, "matrix-scale");
    assert.deepEqual(q.matrixRows, ["维度A", "维度B"]);
  });

  it("parses [矩阵单选题] as matrix-single", () => {
    const q = parseSingle("[矩阵单选题]", "行：\n- 行1\n- 行2");
    assert.equal(q.type, "matrix-single");
    assert.deepEqual(q.matrixRows, ["行1", "行2"]);
  });

  it("parses [矩阵多选题] as matrix-multi", () => {
    const q = parseSingle("[矩阵多选题]", "行：\n- 行1\n- 行2");
    assert.equal(q.type, "matrix-multi");
    assert.deepEqual(q.matrixRows, ["行1", "行2"]);
  });

  it("parses [矩阵填空题] as matrix-fill", () => {
    const q = parseSingle("[矩阵填空题]", "行：\n- 行1");
    assert.equal(q.type, "matrix-fill");
    assert.deepEqual(q.matrixRows, ["行1"]);
  });

  it("parses [文件上传] as file-upload", () => {
    assert.equal(parseSingle("[文件上传]").type, "file-upload");
  });

  it("parses [绘图题] as drawing", () => {
    assert.equal(parseSingle("[绘图题]").type, "drawing");
  });

  it("parses [多级下拉题] as multi-level-dropdown", () => {
    assert.equal(parseSingle("[多级下拉题]").type, "multi-level-dropdown");
  });
});

// ─── parsedQuestionsToWire: col_items for matrix ────────────────────

describe("parsedQuestionsToWire", () => {
  it("converts matrix question with matrixColumns to col_items", () => {
    const questions = [{
      title: "请评价以下方面",
      type: "matrix-single",
      required: true,
      matrixRows: ["服务态度", "响应速度"],
      matrixColumns: ["非常满意", "满意", "一般", "不满意"],
    }];
    const { questions: wire } = parsedQuestionsToWire(questions);

    assert.equal(wire.length, 1);
    assert.equal(wire[0].q_type, 7);
    assert.equal(wire[0].q_subtype, 702);
    assert.deepEqual(wire[0].items, [
      { q_index: 1, item_index: 1, item_title: "服务态度" },
      { q_index: 1, item_index: 2, item_title: "响应速度" },
    ]);
    assert.deepEqual(wire[0].col_items, [
      { q_index: 1, item_index: 1, item_title: "非常满意" },
      { q_index: 1, item_index: 2, item_title: "满意" },
      { q_index: 1, item_index: 3, item_title: "一般" },
      { q_index: 1, item_index: 4, item_title: "不满意" },
    ]);
  });

  it("does not add col_items for non-matrix questions", () => {
    const questions = [{
      title: "选择",
      type: "single-choice",
      required: true,
      options: ["A", "B"],
    }];
    const { questions: wire } = parsedQuestionsToWire(questions);
    assert.equal(wire[0].col_items, undefined);
  });

  it("handles matrix without matrixColumns (no col_items)", () => {
    const questions = [{
      title: "评价",
      type: "matrix",
      required: true,
      matrixRows: ["行1", "行2"],
    }];
    const { questions: wire } = parsedQuestionsToWire(questions);
    assert.equal(wire[0].col_items, undefined);
    assert.deepEqual(wire[0].items, [
      { q_index: 1, item_index: 1, item_title: "行1" },
      { q_index: 1, item_index: 2, item_title: "行2" },
    ]);
  });

  it("throws on unsupported question type", () => {
    const questions = [{
      title: "未知题",
      type: "unknown-type",
      required: true,
    }];
    assert.throws(
      () => parsedQuestionsToWire(questions),
      /不支持的题型/,
    );
  });

  it("filters out paragraph questions and returns them in skippedParagraphs", () => {
    const questions = [
      { title: "段落说明内容", type: "paragraph", required: false },
      { title: "姓名", type: "fill-in", required: true },
      { title: "另一个段落", type: "paragraph", required: false },
    ];
    const { questions: wire, skippedParagraphs } = parsedQuestionsToWire(questions);
    assert.equal(wire.length, 1);
    assert.equal(wire[0].q_title, "姓名");
    assert.equal(wire[0].q_index, 1);
    assert.equal(skippedParagraphs.length, 2);
    assert.equal(skippedParagraphs[0].title, "段落说明内容");
    assert.equal(skippedParagraphs[1].title, "另一个段落");
  });
});
