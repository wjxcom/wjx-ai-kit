import assert from "node:assert/strict";
import test from "node:test";

import {
  SURVEY_TYPES,
  QUESTION_TYPES,
  SURVEY_STATUSES,
  VERIFY_STATUSES,
  STATUS_TRANSITIONS,
  TEXT_VALIDATION_TYPES,
  MATRIX_DISPLAY_TYPES,
  TABLE_DISPLAY_TYPES,
  SURVEY_SETTING_TYPES,
} from "../dist/resources.js";

test("SURVEY_TYPES", async (t) => {
  await t.test("should contain all standard survey types", () => {
    assert.equal(SURVEY_TYPES[1], "调查");
    assert.equal(SURVEY_TYPES[2], "测评");
    assert.equal(SURVEY_TYPES[3], "投票");
    assert.equal(SURVEY_TYPES[6], "考试");
    assert.equal(SURVEY_TYPES[7], "表单");
    assert.equal(SURVEY_TYPES[10], "量表");
  });

  await t.test("should have at least 10 types", () => {
    assert.ok(Object.keys(SURVEY_TYPES).length >= 10);
  });
});

test("QUESTION_TYPES", async (t) => {
  await t.test("should contain core question types matching WJX API spec 3.3", () => {
    // API codes: 1=分页, 2=段落, 3=单选, 4=多选, 5=填空, 6=多项填空, 7=矩阵, 8=文件上传, 9=比重, 10=滑动条
    assert.equal(QUESTION_TYPES[1].name, "分页");
    assert.equal(QUESTION_TYPES[2].name, "段落");
    assert.equal(QUESTION_TYPES[3].name, "单选题");
    assert.equal(QUESTION_TYPES[4].name, "多选题");
    assert.equal(QUESTION_TYPES[5].name, "填空题");
    assert.equal(QUESTION_TYPES[6].name, "多项填空题");
    assert.equal(QUESTION_TYPES[7].name, "矩阵题");
    assert.equal(QUESTION_TYPES[8].name, "文件上传");
    assert.equal(QUESTION_TYPES[9].name, "比重题");
    assert.equal(QUESTION_TYPES[10].name, "滑动条");
  });

  await t.test("should have subtypes for single-choice (q_subtype)", () => {
    assert.ok(QUESTION_TYPES[3].subtypes);
    assert.equal(QUESTION_TYPES[3].subtypes[3], "单选题");
    assert.equal(QUESTION_TYPES[3].subtypes[301], "下拉框");
    assert.equal(QUESTION_TYPES[3].subtypes[302], "量表题");
    assert.equal(QUESTION_TYPES[3].subtypes[305], "判断题");
  });

  await t.test("should have subtypes for matrix (q_subtype)", () => {
    assert.ok(QUESTION_TYPES[7].subtypes);
    assert.equal(QUESTION_TYPES[7].subtypes[702], "矩阵单选题");
    assert.equal(QUESTION_TYPES[7].subtypes[703], "矩阵多选题");
  });

  await t.test("should have exactly 10 main types", () => {
    assert.equal(Object.keys(QUESTION_TYPES).length, 10);
  });
});

test("SURVEY_STATUSES", async (t) => {
  await t.test("should contain all status codes", () => {
    assert.equal(SURVEY_STATUSES[0], "未发布");
    assert.equal(SURVEY_STATUSES[1], "已发布");
    assert.equal(SURVEY_STATUSES[2], "已暂停");
    assert.equal(SURVEY_STATUSES[3], "已删除（回收站，可恢复）");
    assert.equal(SURVEY_STATUSES[4], "彻底删除（不可恢复）");
    assert.equal(SURVEY_STATUSES[5], "被审核");
  });
});

test("VERIFY_STATUSES", async (t) => {
  await t.test("should contain all verify status codes", () => {
    assert.equal(VERIFY_STATUSES[1], "已通过");
    assert.equal(VERIFY_STATUSES[2], "审核中");
    assert.equal(VERIFY_STATUSES[3], "未通过");
    assert.equal(VERIFY_STATUSES[4], "待实名");
  });
});

test("status transitions distinguish recoverable deletion from hard deletion", () => {
  assert.deepEqual(STATUS_TRANSITIONS[3], {
    targets: [4],
    description: "已删除（回收站，可恢复） → 彻底删除（不可恢复）",
  });
  assert.deepEqual(STATUS_TRANSITIONS[4], {
    targets: [],
    description: "彻底删除（终态，不可恢复）",
  });
});

test("field and setting enum references", async (t) => {
  await t.test("contains text validation types", () => {
    assert.equal(TEXT_VALIDATION_TYPES[0], "不验证/单行文本");
    assert.equal(TEXT_VALIDATION_TYPES[8], "Email");
    assert.equal(TEXT_VALIDATION_TYPES[26], "多行文本");
    assert.equal(Object.keys(TEXT_VALIDATION_TYPES).length, 27);
  });

  await t.test("contains matrix and table display types", () => {
    assert.equal(MATRIX_DISPLAY_TYPES[101], "矩阵量表");
    assert.equal(MATRIX_DISPLAY_TYPES[303], "表格下拉框");
    assert.equal(TABLE_DISPLAY_TYPES[1], "表格组合");
    assert.equal(TABLE_DISPLAY_TYPES[2], "表格自增");
  });

  await t.test("contains all survey setting types", () => {
    assert.equal(SURVEY_SETTING_TYPES[1000], "问卷时间设置");
    assert.equal(SURVEY_SETTING_TYPES[1006], "数据推送设置");
    assert.equal(SURVEY_SETTING_TYPES[1007], "问卷所在文件夹");
    assert.equal(Object.keys(SURVEY_SETTING_TYPES).length, 8);
  });
});
