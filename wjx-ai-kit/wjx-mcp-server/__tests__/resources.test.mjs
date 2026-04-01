import assert from "node:assert/strict";
import test from "node:test";

import {
  SURVEY_TYPES,
  QUESTION_TYPES,
  SURVEY_STATUSES,
  VERIFY_STATUSES,
} from "../dist/resources.js";

test("SURVEY_TYPES", async (t) => {
  await t.test("should contain all standard survey types", () => {
    assert.equal(SURVEY_TYPES[1], "调查");
    assert.equal(SURVEY_TYPES[2], "测评");
    assert.equal(SURVEY_TYPES[3], "投票");
    assert.equal(SURVEY_TYPES[6], "考试");
    assert.equal(SURVEY_TYPES[7], "表单");
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
    assert.equal(SURVEY_STATUSES[3], "已删除");
    assert.equal(SURVEY_STATUSES[4], "彻底删除");
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
